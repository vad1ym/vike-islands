import ProductList from '@/components/ProductList?island'

export default function Page() {
  return (
    <div>
      <h1>Product Catalog</h1>
      <ProductList client:never server:cache={9999} />
    </div>
  )
}
