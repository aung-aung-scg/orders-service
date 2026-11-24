import { connection } from "next/server";
import { getProducts } from "@/lib/api";
import { ProductForm } from "../forms";

export default async function ProductsPage() {
  await connection();
  const products = await getProducts();

  return (
    <>
      <h1>Products</h1>
      <ProductForm />
      {products.length ? (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Name</th><th>Stock</th><th>Version</th><th>Created at (UTC)</th></tr></thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.stock}</td>
                  <td>{product.version}</td>
                  <td><time dateTime={product.createdAt}>{product.createdAt}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>No products yet.</p>}
    </>
  );
}
