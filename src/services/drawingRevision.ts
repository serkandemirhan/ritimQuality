import type {ControlPlan,Product} from '../types';

export function drawingRevisionStatus(plan:ControlPlan,product:Product){
  const expected=plan.drawingRevision?.trim();
  const ids=new Set(plan.characteristicImageLinks?.map(link=>link.imageId)||[]);
  const images=(product.images||[]).filter(image=>ids.has(image.id)||image.url===plan.drawingImageUrl);
  const known=images.map(image=>image.revision?.trim()).filter((revision):revision is string=>Boolean(revision));
  const mismatch=Boolean(expected&&known.some(revision=>revision.toLocaleLowerCase('tr')!==expected.toLocaleLowerCase('tr')));
  return {expected:expected||null,known:[...new Set(known)],mismatch,unverified:!expected||!images.length||known.length!==images.length};
}
