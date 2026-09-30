"""Optional Cloudflare recognition; the original Node subtitle CLI stays local."""
import argparse
import json
from pathlib import Path
from .audio import load_audio, analyse
from .cloudflare import MODELS, benchmark, discover
from .captions import PRESETS, strategy_config
from .pipeline import DEFAULT_MODEL, DEFAULT_PROMPT, build_bundle, cost_report, recognize, write_json


def main(argv=None):
    parser = argparse.ArgumentParser(description='Cloudflare audio timing for Content Machine subtitles')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('models', help='Fetch the current Cloudflare ASR inventory')
    p = sub.add_parser('preview', help='Serve a directory on loopback with seekable media')
    p.add_argument('--directory', default='site/public')
    p.add_argument('--port', type=int, default=8767)
    for command in ['recognize', 'build', 'benchmark']:
        p = sub.add_parser(command, help={'recognize': 'Estimate cost, then use --submit to recognize Nepali audio',
            'build': 'Build from saved ASR responses, with no cloud calls', 'benchmark': 'Test the five model adapters; --submit uploads audio'}[command])
        p.add_argument('--audio', required=True)
        p.add_argument('--out', default='Outputs/subtitles/audio')
        if command != 'build':
            p.add_argument('--submit', action='store_true', help='Send audio to Cloudflare and incur usage; without this flag only estimate')
            p.add_argument('--refresh', action='store_true', help='Deliberately resend cached requests, including failures')
            p.add_argument('--prompt', default=DEFAULT_PROMPT, help='Short vocabulary context, not the full script')
        if command == 'benchmark':
            p.add_argument('--models', nargs='+', choices=list(MODELS))
        else:
            p.add_argument('--script', required=True)
            p.add_argument('--preset', default='all')
            p.add_argument('--preeti', action='store_true')
            p.add_argument('--config', help='JSON strategy overrides')
        if command == 'build':
            p.add_argument('--asr', nargs='+', required=True)
    args = parser.parse_args(argv)
    if args.command == 'preview':
        from .preview_server import serve
        serve(args.directory, args.port)
        return
    if args.command == 'models':
        print(json.dumps(discover(), ensure_ascii=False, indent=2))
        return
    try:
        # Fail on invalid inputs before doing any billable work.
        if args.command != 'benchmark':
            script = Path(args.script).read_text(encoding='utf-8-sig')
            if not script.strip():
                raise ValueError('The script is empty')
            overrides = json.loads(Path(args.config).read_text(encoding='utf-8')) if args.config else {}
            if not isinstance(overrides, dict):
                raise ValueError('Strategy config must be a JSON object')
            names = list(dict.fromkeys([*PRESETS, *overrides])) if args.preset == 'all' else [args.preset]
            for name in names:
                if not name.replace('-', '').replace('_', '').isalnum():
                    raise ValueError('Invalid strategy name')
                if name in overrides and not isinstance(overrides[name], dict):
                    raise ValueError('Each strategy override must be an object')
                strategy_config(name, overrides.get(name))
        y, sr = load_audio(args.audio)
        if not len(y):
            raise ValueError('The audio is empty')
        if args.command != 'build' and not args.submit:
            names = (args.models or list(MODELS)) if args.command == 'benchmark' else [DEFAULT_MODEL]
            print(json.dumps({'audio_seconds': len(y)/sr, 'models': [
                {'model': MODELS[n]['id'], 'usd_per_minute': MODELS[n]['usd_per_minute'],
                 'estimated_usd': ((len(y)/sr + (2 if n == 'flux' else 0))/60 * MODELS[n]['usd_per_minute'])
                 if MODELS[n]['usd_per_minute'] is not None else None} for n in names],
                'note': 'No upload made. Add --submit to send audio to Cloudflare. Estimates before allowances, not invoices; rates checked 2026-09-29.'}, indent=2))
            return
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        features = analyse(y, sr)
        write_json(out / 'acoustics.json', features)
        if args.command == 'build':
            records = [{**json.loads(Path(p).read_text(encoding='utf-8')), 'cache_hit': True} for p in args.asr]
        elif args.command == 'benchmark':
            records = benchmark(y, sr, features, out/'raw', args.models, args.prompt, args.refresh)
        else:
            records = recognize(y, sr, features, out/'raw', args.prompt, args.refresh)
        write_json(out/'runs.json', records)
        write_json(out/'cost.json', cost_report(records))
        if args.command == 'benchmark':
            print(json.dumps(cost_report(records), indent=2))
            return
        path, bundle = build_bundle(script, records, features, args.audio, out, args.preset, overrides, args.preeti)
        print(json.dumps({'review_file': str(path), 'default_strategy': bundle['defaultStrategy'],
                          'strategies': {n: len(s['cues']) for n, s in bundle['strategies'].items()},
                          'cost': bundle['cost']}, ensure_ascii=False, indent=2))
    except (ValueError, OSError, RuntimeError) as exc:
        parser.exit(1, f'{exc}\n')


if __name__ == '__main__':
    main()
