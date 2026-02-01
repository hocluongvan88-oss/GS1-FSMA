'use client';

import React, { useState } from 'react';
import { Box, Button, Text, Input } from 'zmp-ui';
import { ProductAutocomplete } from './ProductAutocomplete';

interface BatchItem {
  id: string;
  productName: string;
  gtin?: string;
  quantity: number;
  unit: string;
}

interface BatchInputProps {
  onSubmit: (items: BatchItem[]) => void;
  accessToken: string;
}

export const BatchInput: React.FC<BatchInputProps> = ({ onSubmit, accessToken }) => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [currentItem, setCurrentItem] = useState<Partial<BatchItem>>({
    quantity: 0,
    unit: 'kg'
  });

  const handleAddItem = () => {
    if (!currentItem.productName || !currentItem.quantity || currentItem.quantity <= 0) {
      alert('Vui lòng nhập đầy đủ thông tin sản phẩm và số lượng');
      return;
    }

    const newItem: BatchItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productName: currentItem.productName,
      gtin: currentItem.gtin,
      quantity: currentItem.quantity,
      unit: currentItem.unit || 'kg',
    };

    setItems([...items, newItem]);
    setCurrentItem({ quantity: 0, unit: 'kg' });
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSubmit = () => {
    if (items.length === 0) {
      alert('Vui lòng thêm ít nhất một sản phẩm');
      return;
    }
    onSubmit(items);
    setItems([]);
  };

  return (
    <Box className="bg-white rounded-lg p-4 shadow">
      <Text className="font-semibold text-lg mb-4">Nhập nhiều sản phẩm</Text>

      {/* Add Item Form */}
      <Box className="mb-4 space-y-3">
        <ProductAutocomplete
          accessToken={accessToken}
          onSelect={(product) => {
            setCurrentItem({
              ...currentItem,
              productName: product.name,
              gtin: product.gtin,
              unit: product.unit
            });
          }}
          placeholder="Tên sản phẩm"
        />

        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Số lượng"
            value={currentItem.quantity || ''}
            onChange={(e) => setCurrentItem({
              ...currentItem,
              quantity: parseFloat(e.target.value) || 0
            })}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
          />
          <select
            value={currentItem.unit || 'kg'}
            onChange={(e) => setCurrentItem({ ...currentItem, unit: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="piece">Cái</option>
            <option value="box">Thùng</option>
          </select>
        </div>

        <Button
          onClick={handleAddItem}
          className="w-full bg-emerald-500 text-white py-2 rounded-lg"
        >
          + Thêm vào danh sách
        </Button>
      </Box>

      {/* Items List */}
      {items.length > 0 && (
        <Box className="mb-4">
          <Text className="font-medium text-gray-700 mb-2">
            Danh sách ({items.length} sản phẩm)
          </Text>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <Text className="font-medium">{item.productName}</Text>
                  <Text className="text-sm text-gray-600">
                    {item.quantity} {item.unit}
                    {item.gtin && ` • GTIN: ${item.gtin}`}
                  </Text>
                </div>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="text-red-500 px-2 py-1 hover:bg-red-50 rounded"
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
        </Box>
      )}

      {/* Submit Button */}
      {items.length > 0 && (
        <Button
          onClick={handleSubmit}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
        >
          Ghi nhận {items.length} sản phẩm
        </Button>
      )}
    </Box>
  );
};
