import{c as r,a as e}from"./index-D4o45pbq.js";/**
 * @license lucide-react v0.456.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o=r("Flame",[["path",{d:"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",key:"96xj49"}]]),n={getRecipes:async a=>{const t=await e.get("/production/recipes",{params:a});return{recipes:t.data.data,pagination:t.data.meta}},getRecipeById:async a=>(await e.get(`/production/recipes/${a}`)).data.data,createRecipe:async a=>(await e.post("/production/recipes",a)).data.data,updateRecipe:async(a,t)=>(await e.put(`/production/recipes/${a}`,t)).data.data,previewProduction:async a=>(await e.post("/production/preview",a)).data.data,getProductionOrders:async a=>{const t=await e.get("/production/orders",{params:a});return{orders:t.data.data,pagination:t.data.meta}},executeProductionOrder:async a=>(await e.post("/production/orders",a)).data.data};export{o as F,n as p};
