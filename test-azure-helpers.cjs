// Existing regression scenarios now exercise the second factor instead of bypassing it.
async function completeOTP(page){
 try{await page.locator('#azure-code').waitFor({timeout:1500});}catch{return;}
 await page.locator('#azure-code').fill('123456');
 await page.locator('[data-action="azure-auth-check"]').click();
 await page.locator('#azure-code').waitFor({state:'detached'});
}
async function completeKTC(page){
 if(await page.evaluate(()=>AllinPayDemo.getKTC().passed))return;
 const previous=await page.evaluate(()=>location.hash);
 await page.evaluate(()=>location.hash=location.pathname.includes('external')?'/form/ktc':'/application/ktc');
 await page.locator('[data-action="ktc-start"]').click();
 await page.locator('[data-action="ktc-demo-success"]').click();
 await page.locator('[data-action="ktc-next"]').last().click();
 await page.waitForURL(/\/(application|form)\/2$/);
 await page.evaluate(hash=>location.hash=hash,previous);
 await page.waitForFunction(()=>!!document.querySelector('.v2-form,.ktc-panel'));
}
module.exports={completeOTP,completeKTC};
