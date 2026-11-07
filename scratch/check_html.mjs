async function main() {
  const res = await fetch('http://localhost:3000/');
  const html = await res.text();
  const matches = html.match(/\/instagram\/[^"'\s]+/g) || [];
  console.log('Matches:', Array.from(new Set(matches)));
}
main();
