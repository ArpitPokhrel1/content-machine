"""Build an editor review bundle without changing the supplied script's words."""
import hashlib
import json
from pathlib import Path

from .alignment import align, extract_words, metrics
from .audio import chunks
from .captions import PRESETS, ass, make_cues, preeti_cues, srt, strategy_config, validate
from .cloudflare import MODELS, transcribe

DEFAULT_MODEL = 'whisper-large-v3-turbo'
DEFAULT_PROMPT = 'नेपाली भाषा।'


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def cost_report(records):
    """Separate cached estimates from new requests; failures are never priced as zero."""
    successful = [r for r in records if r.get('http_status') in (200, 101)
                  and not r.get('error') and r.get('response', {}).get('success') is not False]
    new = [r for r in records if not r.get('cache_hit')]
    def price(row):
        if row.get('list_price_estimate_usd') is not None:
            return row['list_price_estimate_usd']
        model = next((m for m in MODELS.values() if m['id'] == row.get('model')), {})
        rate = model.get('usd_per_minute')
        return row['audio_seconds'] / 60 * rate if rate is not None else None
    def estimate(rows):
        values = [price(row) for row in rows]
        return None if any(v is None for v in values) else sum(values)
    return {
        'requests': len(records), 'new_requests': len(new),
        'cached_requests': len(records) - len(new),
        'successful': len(successful), 'failed': len(records) - len(successful),
        'successful_list_estimate_usd': estimate(successful),
        'new_successful_list_estimate_usd': estimate([r for r in successful if not r.get('cache_hit')]),
        'unpriced_successful_requests': sum(price(r) is None for r in successful),
        'note': 'List-price estimates before allowances, not invoices. Failed-call charges and unpublished rates are unknown.',
        'rates_checked': '2026-09-29',
    }


def recognize(y, sr, features, cache_dir, prompt=DEFAULT_PROMPT, refresh=False):
    records = []
    for start, end, audio in chunks(y, sr, features):
        result = transcribe(DEFAULT_MODEL, audio, start, end-start, cache_dir,
                            prompt=prompt, language='ne', refresh=refresh)
        records.append(result)
        if result.get('http_status') != 200 or result.get('response', {}).get('success') is False:
            break  # no automatic retries or charges for the remaining chunks after a failure
    return records


def build_bundle(script, records, features, audio_path, out, preset='all', overrides=None, preeti=False):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    ordered = sorted(records, key=lambda r: r.get('offset', 0))
    if not ordered or any(r.get('http_status') != 200 or r.get('response', {}).get('success') is False for r in ordered):
        raise ValueError('All alignment inputs must be successful HTTP 200 ASR results. See runs.json; no automatic retry was made.')
    if len({r['model'] for r in ordered}) != 1:
        raise ValueError('Choose one ASR model per alignment')
    for a, b in zip(ordered, ordered[1:]):
        if a.get('offset', 0) + a['audio_seconds'] > b.get('offset', 0) + .001:
            raise ValueError('Overlapping ASR inputs: select one run, not baseline plus retries')
    if ordered[0].get('offset', 0) > .05 or ordered[-1].get('offset', 0) + ordered[-1]['audio_seconds'] < features['duration'] - .1:
        raise ValueError('ASR inputs must cover the full recording')
    if any(b.get('offset', 0) > a.get('offset', 0) + a['audio_seconds'] + .05 for a, b in zip(ordered, ordered[1:])):
        raise ValueError('ASR inputs contain a missing audio chunk')
    asr_words = extract_words(ordered)
    words = align(script, asr_words, features['duration'])
    write_json(out / 'alignment.json', words)
    if any(w['end'] <= w['start'] for w in words):
        raise ValueError('Script words lack usable time spans. Review alignment.json and the recording; no script words were removed.')
    scores = metrics(script, ' '.join(w['text'] for w in asr_words))
    overrides = overrides or {}
    names = list(dict.fromkeys([*PRESETS, *overrides])) if preset == 'all' else [preset]
    strategies = {}
    for name in names:
        if not name.replace('-', '').replace('_', '').isalnum():
            raise ValueError('Strategy names must be letters/numbers/hyphens/underscores')
        cfg = strategy_config(name, overrides.get(name))
        cues = make_cues(words, features, name, overrides.get(name))
        errors = validate(cues, features['duration'])
        if errors:
            raise ValueError('\n'.join(errors))
        if ' '.join(c['text'] for c in cues).split() != script.split():
            raise ValueError('Caption grouping changed script words')
        strategies[name] = {
            'cues': cues,
            'style': {'font': cfg['font'], 'size': cfg['font_size'],
                      'width': cfg.get('width', 1920), 'height': cfg.get('height', 1080),
                      'marginV': cfg.get('margin_v', 90), 'marginL': cfg.get('margin_l', 120),
                      'marginR': cfg.get('margin_r', 120)},
        }
    # Validate every strategy before replacing any export.
    stem = Path(audio_path).stem
    for name, strategy in strategies.items():
        cues, style = strategy['cues'], strategy['style']
        (out / f'{stem}.{name}.ne.srt').write_text(srt(cues), encoding='utf-8-sig')
        (out / f'{stem}.{name}.ass').write_text(ass(cues, font=style['font'], size=style['size'],
            width=style['width'], height=style['height'], margin_v=style['marginV'],
            margin_l=style['marginL'], margin_r=style['marginR']), encoding='utf-8-sig')
        if preeti:
            converted, issues = preeti_cues(cues)
            (out / f'{stem}.{name}.preeti.srt').write_text(srt(converted), encoding='utf-8-sig')
            write_json(out / f'{stem}.{name}.preeti-review.json', issues)
    audio_path = Path(audio_path)
    with audio_path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    bundle = {
        'format': 'content-machine-audio-review', 'version': 1,
        'model': ordered[0]['model'], 'language': 'ne', 'script': script,
        'audio': {'name': audio_path.name, 'duration': features['duration'],
                  'sha256': digest},
        'defaultStrategy': 'portrait' if 'portrait' in strategies else names[0],
        'strategies': strategies, 'metrics': scores, 'cost': cost_report(records),
        'waveform': features['rms'][::10],
        'method': 'Script text aligned to ASR words, then refined with pauses and sustained acoustic activity. Pitch and loudness are cues, not emotion labels. Review flagged timings.',
    }
    path = out / f'{stem}.review.json'
    write_json(path, bundle)
    write_json(out / 'metrics.json', scores)
    return path, bundle
