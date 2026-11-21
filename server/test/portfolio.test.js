const {test}=require('node:test');const assert=require('node:assert/strict');const {portfolioImage}=require('../lib/portfolio');
test('portfolio validation accepts image signatures and rejects active content, invalid base64 and oversized files',()=>{
 for(const text of ['<svg onload="alert(1)"></svg>','<script>alert(1)</script>'])assert.throws(()=>portfolioImage(Buffer.from(text).toString('base64')),/Only JPEG/);
 assert.throws(()=>portfolioImage('not base64!'));assert.throws(()=>portfolioImage(Buffer.alloc(1024*1024+1).toString('base64')));
 assert.equal(portfolioImage(Buffer.from([137,80,78,71,13,10,26,10,1,2]).toString('base64')).extension,'png');
 assert.equal(portfolioImage(Buffer.from([255,216,255,...Array(10).fill(0)]).toString('base64')).extension,'jpg');
});
