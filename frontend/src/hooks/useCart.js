import { useContext } from 'react';

import { CartContext } from '../context/cartStore';

export function useCart() {
  const contexto = useContext(CartContext);
  if (!contexto) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return contexto;
}

export default useCart;
