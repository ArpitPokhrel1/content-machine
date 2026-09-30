import pytest
from nepali_subtitles.alignment import align,extract_words,normalized,graphemes
from nepali_subtitles.captions import srt,stamp,validate,preeti_cues,make_cues


def test_devanagari_combining_marks_and_numeral_match():
    assert normalized('१६')==normalized('सोह्र')
    assert graphemes('कर्ण')<len('कर्ण')
    assert normalized('स्वर्गमा')=='स्वर्गमा'


def test_character_alignment_handles_split_word_without_changing_script():
    script='वीरगति प्राप्त गरी'
    raw=[{'text':'वीर','start':0,'end':.3},{'text':'गति','start':.3,'end':.6},{'text':'प्राप्तगरी','start':.6,'end':1.5}]
    out=align(script,raw,2)
    assert [w['text'] for w in out]==script.split()
    assert out[0]['end']==.6
    assert out[-1]['end']==1.5
    assert all(w['match_ratio']==1 for w in out)


def test_missing_script_words_are_flagged():
    out=align('कर्ण आज पृथ्वीमा पुगे', [{'text':'कर्ण','start':0,'end':1},{'text':'पृथ्वीमा','start':2,'end':3},{'text':'पुगे','start':3,'end':4}],4)
    assert out[1]['needs_review']
    assert out[1]['timing_method']=='interpolated'


def test_chunk_offsets_and_invalid_timestamps():
    r={'offset':20,'audio_seconds':10,'response':{'result':{'words':[{'word':'कर्ण','start':1,'end':2},{'word':'bad','start':9,'end':12}]}}}
    out=extract_words([r]);assert len(out)==1;assert out[0]['start']==21


def test_subrip_timestamp_rounds_with_carry():
    assert stamp(59.9996)=='00:01:00,000'
    assert stamp(3600.004)=='01:00:00,004'


def test_validate_catches_overlap_and_duration():
    cues=[{'start':0,'end':2,'text':'कर्ण'},{'start':1,'end':4,'text':'पृथ्वी'}]
    assert len(validate(cues,3))==2


def test_preeti_punctuation_and_conjunct_roundtrip():
    cue={'number':1,'text':'कर्ण श्राद्ध पितृ? ‘वायुपंखी’; अन्ततः!'}
    converted,issues=preeti_cues([cue]);assert not issues
    assert converted[0]['text']!=cue['text']
    assert '<' in converted[0]['text'] and 'Û' in converted[0]['text']


def test_preserves_title_and_avoids_overlap():
    words=align('दानवीर कर्ण\nस्वर्ग पुगे।',[{'text':'दानवीर','start':.5,'end':1},{'text':'कर्ण','start':1,'end':1.5},{'text':'स्वर्ग','start':2,'end':2.5},{'text':'पुगे','start':2.5,'end':3}],4)
    features={'duration':4,'pauses':[],'times':[.5,1,2,2.5],'rms':[.1]*4,'pitch_hz':[140]*4}
    out=make_cues(words,features)
    assert out[0]['text']=='दानवीर कर्ण'
    assert not validate(out,4)
    assert '\n\n2\n' in srt(out)


def test_invalid_strategy_is_rejected():
    with pytest.raises(ValueError,match='must be positive'):
        make_cues([],{'duration':1,'pauses':[]},overrides={'max_words':-1})


def test_media_adapter_sends_content_type_and_reuses_cache(tmp_path,monkeypatch):
    from nepali_subtitles import cloudflare
    calls=[]
    class Response:
        status_code=200
        headers={}
        def json(self):return {'success':True,'result':{'text':'कर्ण'}}
    def post(url,**kwargs):
        calls.append(kwargs);return Response()
    monkeypatch.setattr(cloudflare,'credentials',lambda:('account','secret-test-token'))
    monkeypatch.setattr(cloudflare.httpx,'post',post)
    result=cloudflare.transcribe('nova-3',b'RIFFtest',0,1,tmp_path)
    cloudflare.transcribe('nova-3',b'RIFFtest',0,1,tmp_path)
    assert len(calls)==1
    assert calls[0]['headers']['Content-Type']=='audio/wav'
    assert calls[0]['params']['language']=='ne'
    assert result['http_status']==200
    assert 'secret-test-token' not in next(tmp_path.glob('*.json')).read_text()


def test_preview_server_ranges_and_private_files(tmp_path):
    import threading
    import httpx
    from functools import partial
    from http.server import ThreadingHTTPServer
    from nepali_subtitles.preview_server import PreviewHandler
    (tmp_path/'audio.mp3').write_bytes(b'0123456789')
    (tmp_path/'.env').write_text('secret')
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(PreviewHandler,directory=str(tmp_path)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        root=f'http://127.0.0.1:{server.server_port}'
        r=httpx.get(root+'/audio.mp3',headers={'Range':'bytes=2-5'})
        assert r.status_code==206 and r.content==b'2345'
        assert r.headers['content-range']=='bytes 2-5/10'
        assert httpx.get(root+'/audio.mp3',headers={'Range':'bytes=-3'}).content==b'789'
        assert httpx.get(root+'/audio.mp3',headers={'Range':'bytes=20-30'}).status_code==416
        assert httpx.get(root+'/.env').status_code==403
    finally:
        server.shutdown();server.server_close();thread.join()


def test_custom_strategy_uses_a_base_without_mutating_defaults():
    from nepali_subtitles.captions import strategy_config,PRESETS
    cfg=strategy_config('dramatic',{'base':'shorts','max_words':3})
    assert cfg['max_words']==3 and cfg['font']==PRESETS['shorts']['font']
    assert PRESETS['shorts']['max_words']==5


def test_named_phrase_is_not_split_between_cues():
    text='हामी पितृ पक्ष अर्थात् सोह्र श्राद्ध मनाउँछौँ।'
    raw=[{'text':w,'start':i*.5,'end':(i+1)*.5} for i,w in enumerate(text.split())]
    words=align(text,raw,4)
    features={'duration':4,'pauses':[],'times':[i*.1 for i in range(40)],'rms':[.1]*40,'pitch_hz':[140]*40}
    out=make_cues(words,features,'shorts')
    assert any('सोह्र श्राद्ध' in c['text'].replace('\n',' ') for c in out)
    assert any('पितृ पक्ष' in c['text'].replace('\n',' ') for c in out)
