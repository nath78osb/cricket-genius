import https from 'https';

https.get('https://www.labellerr.com/blog/cricket-ball-detection/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const match = data.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (match) {
        const text = match[1].replace(/<[^>]+>/g, ' ');
        const implIndex = text.indexOf('Implementation - Developing Your First Ball Tracking System');
        if (implIndex !== -1) {
            console.log(text.substring(implIndex, implIndex + 4000));
        } else {
            console.log("Implementation section not found");
        }
    } else {
        console.log("No article found");
    }
  });
});
