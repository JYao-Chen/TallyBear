// Mirrors categoryAmounts; reads existing JSON item details, never creates wallet movements.
export function categoryPartsSql(t='t',amount=t+'.amount'){
 return `(SELECT CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(${t}.line_items) i WHERE COALESCE(i->>'category','')<>'') THEN (
 WITH weights AS (SELECT COALESCE(NULLIF(i->>'category',''),${t}.category) COLLATE "C" AS category,sum(COALESCE((i->>'amount')::numeric,0)) AS weight
 FROM jsonb_array_elements(${t}.line_items) i WHERE NOT ((COALESCE(i->>'kind','item')='discount' OR COALESCE((i->>'amount')::numeric,0)<0) AND COALESCE(i->>'category','')='') GROUP BY 1), shares AS (
 SELECT category,weight,sum(weight) OVER(ORDER BY category) AS cumulative,sum(weight) OVER() AS total FROM weights WHERE weight<>0)
 SELECT COALESCE(jsonb_agg(jsonb_build_object('category',category,'amount',floor(${amount}::numeric*cumulative/total)-floor(${amount}::numeric*(cumulative-weight)/total)) ORDER BY category),'[]'::jsonb) FROM shares
 ) ELSE jsonb_build_array(jsonb_build_object('category',${t}.category,'amount',${amount})) END)`;
}

// A period category keeps its own daily remainder, so day drilldowns equal the chart.
export function periodCategoryPartsSql(t='t'){
 const length=`(${t}.cost_basis_end-${t}.cost_basis_start)`,start=`(${t}.date-${t}.cost_basis_start)`,end=`(${t}.cost_period_end-${t}.cost_basis_start)`,share="(p->>'amount')::numeric";
 return `(CASE WHEN ${t}.cost_row_key IS NULL THEN ${categoryPartsSql(t)} ELSE (SELECT jsonb_agg(jsonb_build_object('category',p->>'category','basis_amount',${share},'amount',floor(${share}/${length})*(${end}-${start})+GREATEST(0,LEAST(${end},mod(${share},${length}))-${start}))) FROM jsonb_array_elements(${categoryPartsSql(t,t+'.cost_basis_amount')}) p) END)`;
}
