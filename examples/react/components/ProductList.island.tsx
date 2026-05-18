import ProductCard from './ProductCard'

console.log('[ProductList] rendering')

async function fetchProducts() {
  const res = await fetch('https://dummyjson.com/products?limit=100&select=id,title,price,rating,stock,category,tags,description,thumbnail')
  const data = await res.json()
  return data.products as any[]
}

export default async function ProductList() {
  const products = await fetchProducts()

  return (
    <div className="product-grid">
      {products.map((p: any) => (
        <ProductCard
          key={p.id}
          id={p.id}
          title={p.title}
          price={p.price}
          rating={p.rating}
          reviewCount={p.stock}
          category={p.category}
          tags={p.tags ?? []}
          inStock={p.stock > 0}
          description={p.description}
          imageIndex={p.id}
          thumbnail={p.thumbnail}
        />
      ))}
    </div>
  )
}
