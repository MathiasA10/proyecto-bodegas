import { useEffect, useMemo, useState } from 'react';

import { CartContext } from './cartStore';

const STORAGE_KEY = 'bodega_cart_v1';

function resumenTienda(tienda) {
  if (!tienda) return null;
  return {
    id: tienda.id,
    nombre: tienda.nombre_comercial || tienda.nombre || 'Bodega',
  };
}

function normalizarProducto(producto) {
  return {
    id: producto.id,
    nombre: producto.nombre,
    precio: Number(producto.precio),
    stock: Number(producto.stock ?? 0),
    imagen: producto.imagen || null,
    categoria: producto.categoria || 'OTROS',
    cantidad: 1,
  };
}

export function CartProvider({ children }) {
  const [bodega, setBodega] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (!guardado) return;

      const datos = JSON.parse(guardado);
      if (datos && Array.isArray(datos.items)) {
        setBodega(datos.bodega || null);
        setItems(datos.items);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      if (items.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ bodega, items }));
      }
    } catch {
      // almacenamiento no disponible
    }
  }, [bodega, items]);

  const agregar = (tienda, producto) => {
    const tiendaResumen = resumenTienda(tienda);
    const cambiaDeTienda = Boolean(bodega && bodega.id !== tienda.id);
    const productoNuevo = normalizarProducto(producto);

    if (productoNuevo.stock <= 0) return;

    setItems((previos) => {
      const base = cambiaDeTienda ? [] : previos;
      const existente = base.find((item) => item.id === productoNuevo.id);

      if (existente) {
        if (existente.cantidad >= productoNuevo.stock) return base;
        return base.map((item) =>
          item.id === productoNuevo.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }

      return [...base, productoNuevo];
    });

    setBodega((previa) =>
      previa && previa.id === tienda.id ? previa : tiendaResumen
    );
  };

  const modificarCantidad = (id, delta) => {
    setItems((previos) =>
      previos
        .map((item) => {
          if (item.id !== id) return item;
          const nuevaCantidad = Math.min(
            Math.max(item.cantidad + delta, 0),
            item.stock
          );
          return { ...item, cantidad: nuevaCantidad };
        })
        .filter((item) => item.cantidad > 0)
    );
  };

  const eliminar = (id) => {
    setItems((previos) => previos.filter((item) => item.id !== id));
  };

  const vaciar = () => {
    setItems([]);
    setBodega(null);
  };

  const { total, cantidadTotal } = useMemo(() => {
    return items.reduce(
      (acumulado, item) => {
        acumulado.total += Number(item.precio) * item.cantidad;
        acumulado.cantidadTotal += item.cantidad;
        return acumulado;
      },
      { total: 0, cantidadTotal: 0 }
    );
  }, [items]);

  const esDeTienda = (tiendaId) =>
    Boolean(bodega && Number(bodega.id) === Number(tiendaId));

  const value = {
    bodega,
    items,
    total,
    cantidadTotal,
    agregar,
    modificarCantidad,
    eliminar,
    vaciar,
    esDeTienda,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
