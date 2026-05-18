import { Island } from 'vike-islands/react'
import Counter from './Counter.island'
import ProductCard from './ProductCard'

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Toys', 'Food', 'Beauty']
const TAGS = ['sale', 'new', 'hot', 'limited', 'eco', 'premium', 'bestseller', 'exclusive', 'organic', 'handmade']

function seeded(seed: number) {
  let s = seed
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646 }
}

const products = Array.from({ length: 300 }, (_, i) => {
  const rnd = seeded(i + 1)
  const tagCount = 2 + Math.floor(rnd() * 3)
  return {
    id: i + 1,
    title: `Product ${i + 1} — ${['Wireless', 'Premium', 'Ultra', 'Smart', 'Pro', 'Eco'][Math.floor(rnd() * 6)]} ${['Headphones', 'Watch', 'Keyboard', 'Monitor', 'Chair', 'Lamp', 'Bag', 'Shoes'][Math.floor(rnd() * 8)]}`,
    price: Math.round((9.99 + rnd() * 490) * 100) / 100,
    rating: Math.round((2.5 + rnd() * 2.5) * 10) / 10,
    reviewCount: Math.floor(rnd() * 4800) + 12,
    category: CATEGORIES[Math.floor(rnd() * CATEGORIES.length)],
    tags: Array.from({ length: tagCount }, () => TAGS[Math.floor(rnd() * TAGS.length)]),
    inStock: rnd() > 0.2,
    description: 'High-quality product with exceptional performance. Features include advanced technology, durable materials, and elegant design. Perfect for everyday use and professional applications.',
    imageIndex: i,
  }
})

export default function ProductList() {
  return (
    <div className="product-grid">
      {products.map(p => (
        <ProductCard key={p.id} {...p} />
      ))}
      <Island
        name="Counter"
        component={Counter}
        hydrate="visible"
      />
    </div>
  )
}
