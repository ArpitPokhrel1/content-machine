"""Character edit alignment preserves supplied spelling across ASR split/merge errors."""
import re
import unicodedata
import numpy as np
import regex
from rapidfuzz.distance import Levenshtein


def normalized(s):
    s=unicodedata.normalize('NFC',s).replace('१६','सोह्र').replace('16','सोह्र')
    return ''.join(c for c in s if unicodedata.category(c)[0] in 'LMN' and c not in '\u200c\u200d')


def graphemes(s):
    return len(regex.findall(r'\X',s))


def extract_words(records):
    words=[]
    for record in sorted(records,key=lambda d:d.get('offset',0)):
        offset=record.get('offset',0)
        result=record.get('response',{}).get('result',{})
        raw=result.get('words') or [w for seg in result.get('segments',[]) for w in seg.get('words',[])]
        for w in raw:
            start=offset+float(w['start']);end=offset+float(w['end'])
            if not 0<=w['start']<w['end']<=record['audio_seconds']+.1:
                continue
            words.append({'text':w.get('word',w.get('text','')).strip(),'start':start,'end':end,'source':record.get('model')})
    return words


def align(script, asr_words, duration):
    tokens=re.findall(r'\S+',script)
    line_ends=set(); count=0
    for line in script.splitlines():
        count+=len(line.split())
        if line.strip():line_ends.add(count-1)
    if not tokens or not asr_words:
        raise ValueError('Script and valid ASR word timestamps are required')
    ref='';spans=[]
    for token in tokens:
        n=normalized(token); spans.append((len(ref),len(ref)+len(n)));ref+=n
    hyp='';chars=[]
    for i,w in enumerate(asr_words):
        n=normalized(w['text']);hyp+=n
        for k in range(len(n)):
            chars.append((w['start']+(w['end']-w['start'])*k/len(n), w['start']+(w['end']-w['start'])*(k+1)/len(n),i))
    mapping={}; exact=set()
    for tag,a,b,c,d in Levenshtein.opcodes(ref,hyp):
        if tag=='equal':
            for x,z in zip(range(a,b),range(c,d)):mapping[x]=z;exact.add(x)
        elif tag=='replace':
            for x,z in zip(range(a,b),range(c,d)):mapping[x]=z
    if not mapping:raise ValueError('No usable alignment anchors')
    anchors=sorted(mapping)
    centers=[(chars[mapping[k]][0]+chars[mapping[k]][1])/2 for k in anchors]
    allcenters=np.interp(np.arange(len(ref)),anchors,centers)
    aligned=[]
    for i,(token,(a,b)) in enumerate(zip(tokens,spans)):
        mapped=[mapping[k] for k in range(a,b) if k in mapping]
        ratio=sum(k in exact for k in range(a,b))/max(1,b-a)
        if mapped:
            start=chars[min(mapped)][0];end=chars[max(mapped)][1]
            source_ids=sorted(set(chars[k][2] for k in mapped))
        else:
            center=float(np.mean(allcenters[a:b])) if b>a else (aligned[-1]['end'] if aligned else 0)
            start=max(0,center-.035);end=min(duration,center+.035);source_ids=[]
        aligned.append({'index':i,'line_end':i in line_ends,'text':token,'start':round(start,4),'end':round(end,4),'match_ratio':round(ratio,3),
                        'timing_method':'asr_character_alignment' if mapped else 'interpolated',
                        'needs_review':not mapped or ratio<.45,'asr_words':[asr_words[k]['text'] for k in source_ids]})
    # Deleted spans: interpolate only inside surrounding anchors; explicitly mark them.
    i=0
    while i<len(aligned):
        if aligned[i]['timing_method']!='interpolated':i+=1;continue
        j=i
        while j<len(aligned) and aligned[j]['timing_method']=='interpolated':j+=1
        left=aligned[i-1]['end'] if i else asr_words[0]['start']
        right=aligned[j]['start'] if j<len(aligned) else asr_words[-1]['end']
        weights=[max(1,graphemes(w['text'])) for w in aligned[i:j]];total=sum(weights);cursor=left
        for w,weight in zip(aligned[i:j],weights):
            end=cursor+max(0,right-left)*weight/total
            w.update(start=round(cursor,4),end=round(end,4));cursor=end
        i=j
    return aligned


def metrics(reference,hypothesis):
    import jiwer
    def wordnorm(s):
        return ' '.join(filter(None,(normalized(w) for w in s.split())))
    r,h=wordnorm(reference),wordnorm(hypothesis)
    return {'wer':jiwer.wer(r,h),'cer':jiwer.cer(r.replace(' ',''),h.replace(' ','')),
            'reference_words':len(r.split()),'hypothesis_words':len(h.split()),
            'normalization':'NFC; strip punctuation/join controls; expand 16/१६ to सोह्र. WER keeps word spaces; CER omits spaces.'}
