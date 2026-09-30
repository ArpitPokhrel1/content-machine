"""Regression from Karna: cue begins inside a low-energy lead-in."""
import json
from pathlib import Path
import numpy as np
from nepali_subtitles.captions import make_cues
ROOT=Path(__file__).resolve().parents[1]

def test_onset_refinement_keeps_active_speech_and_ignores_short_noise():
    from nepali_subtitles.audio import audible_onset
    f={'times':np.arange(0,1,.01).tolist(),'rms':[.001]*100}
    f['rms'][10]=.05  # isolated click
    f['rms'][30:70]=[.1]*40
    assert abs(audible_onset(.05,.8,f)-.33)<.001
    assert audible_onset(.4,.8,f)==.4


def test_portrait_ass_has_vertical_canvas():
    from nepali_subtitles.captions import ass,PRESETS
    cfg=PRESETS['portrait'];out=ass([],width=cfg['width'],height=cfg['height'],margin_v=cfg['margin_v'])
    assert 'PlayResX: 1080' in out and 'PlayResY: 1920' in out
    assert ',350,1' in out
