'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Box, Input, Text } from 'zmp-ui';

interface Product {
  id: string;
  gtin: string;
  name: string;
  category: string;
  unit: string;
}

interface ProductAutocompleteProps {
  onSelect: (product: Product) => void;
  accessToken: string;
  placeholder?: string;
}

export const ProductAutocomplete: React.FC<ProductAutocompleteProps> = ({
  onSelect,
  accessToken,
  placeholder = 'Tìm sản phẩm...'
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // Debounce search
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      searchProducts(query);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query]);

  const searchProducts = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?or=(name.ilike.*${searchQuery}*,gtin.ilike.*${searchQuery}*)&limit=5`,
        {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
      }
    } catch (error) {
      console.error('[v0] Product search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (product: Product) => {
    setQuery(product.name);
    setIsOpen(false);
    onSelect(product);
  };

  return (
    <Box className="relative">
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
      />
      
      {isLoading && (
        <div className="absolute right-3 top-3">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((product) => (
            <button
              key={product.id}
              onClick={() => handleSelect(product)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-b-0"
            >
              <div className="flex-1">
                <Text className="font-medium text-gray-900">{product.name}</Text>
                <Text className="text-xs text-gray-500">
                  GTIN: {product.gtin} • {product.category}
                </Text>
              </div>
              <Text className="text-xs text-gray-400 ml-2">{product.unit}</Text>
            </button>
          ))}
        </div>
      )}
    </Box>
  );
};
