async function main() {
  const res = await fetch('http://localhost:3000/');
  const html = await res.text();
  const match = html.match(/class="safe-image-img[^"]*"[^>]*style="([^"]*)"/);
  console.log('SafeImage style in SSR HTML:', match ? match[1] : 'No match');
  console.log('Has opacity:0 ?', match ? match[1].includes('opacity') : false);
}
main();
