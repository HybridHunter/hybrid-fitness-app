export function getYTId(url){if(!url)return null;const m=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);return m?m[1]:null;}
export function getYTThumb(url){const id=getYTId(url);return id?"https://img.youtube.com/vi/"+id+"/mqdefault.jpg":null;}
