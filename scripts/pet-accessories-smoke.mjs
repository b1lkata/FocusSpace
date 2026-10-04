import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='.runtime/pet-accessories';mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});const report={checks:[],errors:[]};
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',error=>report.errors.push(error.message));await page.goto('http://127.0.0.1:4173/');
 for(const shape of ['blob','cat','bear','star']) for(const accessory of ['headphones','sprout','cap','bow','glasses']) {
  await page.getByLabel('Companion shape',{exact:true}).selectOption(shape);await page.getByLabel('Companion accessory',{exact:true}).selectOption(accessory);
  for(const dance of [false,true]) {
   await page.getByLabel('Companion mood',{exact:true}).selectOption(dance?'excited':'auto');
   const result=await page.locator('.buddy-rig').evaluate((rig)=>{
    const animation=rig.getAnimations()[0];if(!animation)throw Error('Missing movement');animation.pause();const duration=Number(animation.effect.getTiming().duration);const positions=[];
    for(const phase of [.0,.5]) {
     animation.currentTime=duration*phase;
     const style=getComputedStyle(rig),matrix=new DOMMatrix(style.transform),origin=style.transformOrigin.split(' ').map(parseFloat),parent=rig.parentElement.getBoundingClientRect();
     for(const selector of ['.buddy-shape','.buddy-accessory','.buddy-foot.left','.buddy-foot.right']) {
      const element=rig.querySelector(selector),rect=element.getBoundingClientRect();const local=new DOMPoint(element.offsetLeft+element.offsetWidth/2-origin[0],element.offsetTop+element.offsetHeight/2-origin[1]).matrixTransform(matrix);
      const error=Math.hypot(rect.x+rect.width/2-(parent.x+origin[0]+local.x),rect.y+rect.height/2-(parent.y+origin[1]+local.y));if(error>.2)throw Error(`${selector} detached by ${error}`);
     }
     positions.push(style.transform);
    }
    animation.play();return positions;
   });expect(result[0]).not.toBe(result[1]);report.checks.push(`${shape}/${accessory}/${dance?'dance':'breathe'} attached at opposite animation phases`);
  }
 }
 await page.setViewportSize({width:390,height:844});await page.getByLabel('Companion shape',{exact:true}).selectOption('cat');await page.getByLabel('Companion accessory',{exact:true}).selectOption('headphones');await page.locator('.viewport-companion').screenshot({path:`${out}/cat-headphones.png`});
 const pet=page.getByRole('button',{name:'Move Pip',exact:true});await pet.focus();await pet.press('Space');await pet.press('ArrowLeft');await pet.press('Space');await expect(page.locator('.viewport-companion')).not.toHaveClass(/grabbed/);
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.buddy-rig').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'Pause visual motion'}).click();expect(await page.locator('.buddy-rig').evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('paused');
 expect(report.errors).toEqual([]);console.log('PASS 40 shape/accessory/animation combinations, phone keyboard drag, reduced motion and pause');
}finally{await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
