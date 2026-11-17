import assert from "node:assert/strict";
import test from "node:test";
import { replaceCatalogItems, searchRelevantCatalog } from "./db";

test("catálogo usa precio actualizado y no recomienda productos al azar", () => {
  replaceCatalogItems([{name:"Producto prueba único",price:"$600",aliases:"articulo especial",active:true}]);
  assert.equal(searchRelevantCatalog("articulo especial")[0]?.price,"$600");
  replaceCatalogItems([{name:"Producto prueba único",price:"$700",active:true}]);
  assert.equal(searchRelevantCatalog("articulo especial")[0]?.price,"$700");
  assert.deepEqual(searchRelevantCatalog("información desconocida"),[]);
});
