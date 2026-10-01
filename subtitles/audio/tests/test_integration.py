import json
import numpy as np
import pytest
import soundfile as sf
from nepali_subtitles.pipeline import build_bundle, cost_report, recognize
from nepali_subtitles.cli import main
from nepali_subtitles import cloudflare


def fixture(tmp_path):
    path=tmp_path/'test.wav'
    sf.write(path,np.zeros(64000),16000)
    features={'duration':4,'pauses':[],'times':np.arange(0,4,.01).tolist(),'rms':[.1]*400,'pitch_hz':[140]*400}
    record={'model':'@cf/openai/whisper-large-v3-turbo','http_status':200,'offset':0,'audio_seconds':4,'cache_hit':True,
        'list_price_estimate_usd':.0000342,'response':{'success':True,'result':{'words':[
            {'word':'दानवीर','start':.66,'end':1},{'word':'कर्ण','start':1,'end':1.6},
            {'word':'स्वर्ग','start':2.14,'end':2.8},{'word':'पुगे।','start':2.8,'end':3.5}]}}}
    return path,features,record


def test_build_all_strategies_preserves_script_and_billing(tmp_path):
    path,features,record=fixture(tmp_path)
    script='दानवीर कर्ण\nस्वर्ग पुगे।'
    output,bundle=build_bundle(script,[record],features,path,tmp_path/'out',preeti=True)
    assert output.exists()
    assert bundle['defaultStrategy']=='portrait'
    assert set(bundle['strategies'])=={'portrait','narrative','shorts','calm','word'}
    assert bundle['cost']['new_requests']==0
    for name,strategy in bundle['strategies'].items():
        assert ' '.join(c['text'] for c in strategy['cues']).split()==script.split()
        assert (output.parent/f'test.{name}.preeti.srt').exists()
    assert 'PlayResY: 1920' in (output.parent/'test.portrait.ass').read_text(encoding='utf-8-sig')
    assert str(tmp_path) not in output.read_text(encoding='utf-8')  # no local paths in portable bundle


def test_reject_missing_chunks_and_failed_results(tmp_path):
    path,f,r=fixture(tmp_path)
    for bad in [{**r,'http_status':500},{**r,'audio_seconds':2},{**r,'offset':1}]:
        with pytest.raises(ValueError):build_bundle('दानवीर कर्ण',[bad],f,path,tmp_path/'out')
    assert not list((tmp_path/'out').glob('*.srt'))


def test_unspoken_script_words_are_not_silently_dropped(tmp_path):
    path,f,r=fixture(tmp_path)
    script='दानवीर कर्ण\nआज स्वर्ग पुगे।'
    _,bundle=build_bundle(script,[r],f,path,tmp_path/'out')
    assert any(c['needs_review'] for c in bundle['strategies']['portrait']['cues'])
    assert 'आज' in ' '.join(c['text'] for c in bundle['strategies']['portrait']['cues'])


def test_estimate_never_calls_cloudflare(tmp_path,monkeypatch,capsys):
    path,_,_=fixture(tmp_path)
    script=tmp_path/'script.txt';script.write_text('दानवीर कर्ण',encoding='utf-8')
    monkeypatch.setattr(cloudflare.httpx,'post',lambda *a,**k:pytest.fail('estimate uploaded audio'))
    main(['recognize','--audio',str(path),'--script',str(script)])
    estimate=json.loads(capsys.readouterr().out)
    assert estimate['models'][0]['model']=='@cf/openai/whisper-large-v3-turbo'
    assert estimate['models'][0]['estimated_usd']==pytest.approx(.0000342)


def test_request_cache_prevents_rebilling_and_timeout_is_not_retried(tmp_path,monkeypatch):
    import httpx
    calls=[]
    monkeypatch.setattr(cloudflare,'credentials',lambda:('account','not-a-real-secret'))
    def fail(*a,**k):
        calls.append(1)
        raise httpx.ReadTimeout('timeout')
    monkeypatch.setattr(cloudflare.httpx,'post',fail)
    r=cloudflare.transcribe('whisper-large-v3-turbo',b'audio',0,4,tmp_path)
    cached=cloudflare.transcribe('whisper-large-v3-turbo',b'audio',0,4,tmp_path)
    assert len(calls)==1 and r['http_status'] is None and cached['cache_hit']
    report=cost_report([r,cached])
    assert report['failed']==2 and report['new_requests']==1
    assert 'unknown' in report['note']
    assert 'not-a-real-secret' not in next(tmp_path.glob('*.json')).read_text(encoding='utf-8')


def test_recognition_stops_at_first_failed_chunk(tmp_path,monkeypatch):
    from nepali_subtitles import pipeline
    calls=[]
    monkeypatch.setattr(pipeline,'transcribe',lambda *a,**k:(calls.append(1) or {'http_status':500}))
    results=recognize(np.zeros(16000*50),16000,{'pauses':[]},tmp_path)
    assert len(results)==len(calls)==1


def test_invalid_strategy_fails_before_upload(tmp_path,monkeypatch):
    path,_,_=fixture(tmp_path)
    script=tmp_path/'script.txt';script.write_text('कर्ण',encoding='utf-8')
    monkeypatch.setattr(cloudflare.httpx,'post',lambda *a,**k:pytest.fail('invalid input uploaded'))
    with pytest.raises(SystemExit) as error:
        main(['recognize','--submit','--audio',str(path),'--script',str(script),'--preset','unknown'])
    assert error.value.code==1


def test_unknown_price_is_not_reported_as_zero():
    result=cost_report([{'model':'@cf/openai/whisper-tiny-en','http_status':200,'audio_seconds':4}])
    assert result['successful_list_estimate_usd'] is None
    assert result['unpriced_successful_requests']==1


def test_historical_results_get_known_snapshot_rate():
    result=cost_report([{'model':'@cf/openai/whisper-large-v3-turbo','http_status':200,'audio_seconds':90.264,'cache_hit':True}])
    assert result['successful_list_estimate_usd']==pytest.approx(.0007717572)
    assert result['new_successful_list_estimate_usd']==0
