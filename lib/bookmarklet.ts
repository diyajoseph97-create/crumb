// The "Save to Crumb" bookmark button. Clicked while viewing a Reel on
// instagram.com, it reads the page's link and caption (what's already on your
// screen; nothing is sent anywhere else) and opens Crumb with them filled in.
export function bookmarkletCode(appUrl: string) {
  const js = `(()=>{try{
var u=location.href.split('?')[0];
var c='';
var hs=document.querySelectorAll('article h1, main h1, h1');
for(var i=0;i<hs.length;i++){var x=hs[i].innerText||'';if(x.length>c.length)c=x;}
var m=document.querySelector('meta[property="og:description"]');
var d=(m&&m.content)||'';
var q=d.match(/:\\s*["\\u201c]([\\s\\S]*)["\\u201d]\\s*\\.?\\s*$/);
var c2=q?q[1]:'';
if(c2.length>c.length)c=c2;
if(!/instagram\\.com\\/(reel|reels|p|tv)\\//.test(u)){alert('Open a Reel on instagram.com first, then click Save to Crumb.');return;}
window.open(${JSON.stringify(appUrl)}+'#add='+encodeURIComponent(JSON.stringify({u:u,c:c.slice(0,8000)})),'_blank');
}catch(e){alert('Crumb could not read this page: '+e.message);}})();`;
  return "javascript:" + encodeURIComponent(js.replace(/\n/g, ""));
}

/** Reads what the bookmark button passed in (#add=…). */
export function readAddHash(hash: string): { url: string; caption: string } | null {
  const m = hash.match(/^#add=(.*)$/);
  if (!m) return null;
  try {
    const o = JSON.parse(decodeURIComponent(m[1]));
    return { url: typeof o.u === "string" ? o.u : "", caption: typeof o.c === "string" ? o.c : "" };
  } catch {
    return null;
  }
}
