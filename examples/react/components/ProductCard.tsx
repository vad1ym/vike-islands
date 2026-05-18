import { useState } from 'react'

interface ProductCardProps {
  id: number
  title: string
  price: number
  rating: number
  reviewCount: number
  category: string
  tags: string[]
  inStock: boolean
  description: string
  imageIndex: number
  thumbnail?: string
}

export default function ProductCard({
  id, title, price, rating, reviewCount, category, tags, inStock, description, imageIndex, thumbnail,
}: ProductCardProps) {
  const [liked, setLiked] = useState(false)
  const [added, setAdded] = useState(false)
  const [quantity, setQuantity] = useState(1)

  function addToCart() {
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className={`product-card${inStock ? '' : ' out-of-stock'}`}>
      <div className="product-image" style={thumbnail ? {} : { background: `hsl(${imageIndex * 37 % 360}, 60%, 85%)` }}>
        {thumbnail && <img src={thumbnail} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        <span className="product-id">#{id}</span>
        <button className={`like-btn${liked ? ' liked' : ''}`} onClick={() => setLiked((l: boolean) => !l)}>
          {liked ? '♥' : '♡'}
        </button>
      </div>

      <div className="product-body">
        <div className="product-meta">
          <span className="category">{category}</span>
          <span className={`stock-badge ${inStock ? 'in-stock' : 'no-stock'}`}>
            {inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>

        <h3 className="product-title">{title}</h3>
        <p className="product-desc">{description}</p>

        <div className="product-tags">
          {tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
        </div>

        <div className="product-rating">
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} className={`star${i <= Math.round(rating) ? ' filled' : ''}`}>★</span>
          ))}
          <span className="rating-value">{rating.toFixed(1)}</span>
          <span className="review-count">({reviewCount} reviews)</span>
        </div>

        <div className="product-footer">
          <div className="price-block">
            <span className="price">${price.toFixed(2)}</span>
            <span className="price-per">per unit</span>
          </div>
          <div className="cart-controls">
            <div className="qty-control">
              <button onClick={() => setQuantity((q: number) => Math.max(1, q - 1))}>−</button>
              <span>{quantity}</span>
              <button onClick={() => setQuantity((q: number) => q + 1)}>+</button>
            </div>
            <button className={`add-btn${added ? ' added' : ''}`} disabled={!inStock} onClick={addToCart}>
              {added ? '✓ Added' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
