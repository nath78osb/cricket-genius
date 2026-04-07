import https from 'https';

https.get('https://www.labellerr.com/blog/cricket-ball-detection/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const match = data.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (match) {
        console.log(match[1].replace(/<[^>]+>/g, ' ').substring(0, 3000));
    } else {
        console.log(data.substring(0, 3000));
    }
  });
});
