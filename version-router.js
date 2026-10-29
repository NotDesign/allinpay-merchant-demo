// Keep explicitly versioned bookmarks on the release they originally named.
(()=>{
 const version=new URLSearchParams(location.search).get('v')||'';
 if(location.pathname.includes('/versions/'))return;
 const directory=['20260929-restored','391f597'].includes(version)?'versions/20260929/':version==='20261009-control-spacing-v3'?'versions/20261009-control-spacing-v3/':'';
 if(!directory)return;
 const filename=location.pathname.endsWith('external.html')?'external.html':'backoffice.html';
 const target=new URL(directory+filename,location.href);target.search=location.search;target.hash=location.hash||'#/login';location.replace(target.href);
})();
