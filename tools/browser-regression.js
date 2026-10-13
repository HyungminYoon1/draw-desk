async (page) => {
  const failures=[];
  await page.goto('http://127.0.0.1:4291/');
  await page.setViewportSize({width:1440,height:1000});
  const raw=await page.evaluate(async()=>{const m=await import('./src/model.js');const d=m.blankDocument();d.layers[0].items=[{id:'qa-rect',type:'rect',x:500,y:300,width:400,height:300,size:2,color:'#112233',fill:'#de895e',opacity:1,transform:m.identity()}];return JSON.stringify(d);});
  await page.evaluate(raw=>localStorage.setItem('draw-desk-project-v1',raw),raw);await page.reload();
  await page.waitForFunction(()=>document.querySelector('#object-count').textContent.includes('1 개체'));
  await page.locator('[data-tool=select]').click();
  const rect=await page.locator('#canvas').boundingBox();
  const zoom=Number(await page.locator('#zoom').inputValue())/100;
  const x=rect.x+rect.width/2+(700-1200)*zoom,y=rect.y+rect.height/2+(450-800)*zoom;
  await page.mouse.click(x,y);
  const initial=await page.locator('#select-x').inputValue();
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+50,y+25,{steps:6});
  await page.keyboard.press('Escape');await page.mouse.up();
  await page.locator('#title').fill('취소 후 저장');await page.locator('#title').press('Tab');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('draw-desk-project-v1')));
  if(saved.layers[0].items[0].transform.x!==0)failures.push('ESC_ROLLBACK: cancelled drag persisted transform.x='+saved.layers[0].items[0].transform.x);
  await page.locator('#undo').click();
  await page.mouse.click(x,y);
  await page.locator('#size').fill('3');await page.locator('#size').press('Tab');
  const fill=await page.evaluate(()=>JSON.parse(localStorage.getItem('draw-desk-project-v1')).layers[0].items[0].fill);
  if(fill!=='#de895e')failures.push('STYLE_PRESERVATION: width edit changed fill to '+fill);
  if(failures.length)throw Error(failures.join('; '));
  console.log('PASS draw Escape rollback and independent fill preservation; initial center '+initial);
}
