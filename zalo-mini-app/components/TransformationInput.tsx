'use client'

import { useState } from 'react'
import { ProductAutocomplete } from './ProductAutocomplete'

interface Product {
  gtin: string
  name: string
  quantity: number
  uom: string
}

interface TransformationInputProps {
  onSubmit: (data: {
    inputProducts: Product[]
    outputProducts: Product[]
    location: string
    productType?: string
  }) => Promise<void>
  accessToken: string
}

export function TransformationInput({ onSubmit, accessToken }: TransformationInputProps) {
  const [inputProducts, setInputProducts] = useState<Product[]>([])
  const [outputProducts, setOutputProducts] = useState<Product[]>([])
  const [currentInput, setCurrentInput] = useState({ gtin: '', name: '', quantity: 0, uom: 'kg' })
  const [currentOutput, setCurrentOutput] = useState({ gtin: '', name: '', quantity: 0, uom: 'kg' })
  const [location, setLocation] = useState('')
  const [productType, setProductType] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAddInput = () => {
    if (currentInput.gtin && currentInput.quantity > 0) {
      setInputProducts([...inputProducts, { ...currentInput }])
      setCurrentInput({ gtin: '', name: '', quantity: 0, uom: 'kg' })
    }
  }

  const handleAddOutput = () => {
    if (currentOutput.gtin && currentOutput.quantity > 0) {
      setOutputProducts([...outputProducts, { ...currentOutput }])
      setCurrentOutput({ gtin: '', name: '', quantity: 0, uom: 'kg' })
    }
  }

  const handleRemoveInput = (index: number) => {
    setInputProducts(inputProducts.filter((_, i) => i !== index))
  }

  const handleRemoveOutput = (index: number) => {
    setOutputProducts(outputProducts.filter((_, i) => i !== index))
  }

  const calculateTotalInput = () => {
    return inputProducts.reduce((sum, p) => sum + p.quantity, 0)
  }

  const calculateTotalOutput = () => {
    return outputProducts.reduce((sum, p) => sum + p.quantity, 0)
  }

  const calculateConversionFactor = () => {
    const totalIn = calculateTotalInput()
    const totalOut = calculateTotalOutput()
    if (totalIn === 0) return 0
    return ((totalOut / totalIn) * 100).toFixed(1)
  }

  const handleSubmit = async () => {
    if (inputProducts.length === 0) {
      alert('Vui lòng thêm ít nhất 1 nguyên liệu đầu vào')
      return
    }
    if (outputProducts.length === 0) {
      alert('Vui lòng thêm ít nhất 1 sản phẩm đầu ra')
      return
    }
    if (!location) {
      alert('Vui lòng nhập vị trí (GLN)')
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        inputProducts,
        outputProducts,
        location,
        productType: productType || undefined
      })
      
      // Reset form
      setInputProducts([])
      setOutputProducts([])
      setLocation('')
      setProductType('')
    } catch (error) {
      console.error('[v0] Submit error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg p-4 text-white">
        <h3 className="font-bold text-lg mb-1">Chế biến / Biến đổi</h3>
        <p className="text-sm opacity-90">Ghi nhận quá trình chuyển đổi nguyên liệu thành sản phẩm</p>
      </div>

      {/* Input Products Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          📥 Nguyên liệu đầu vào
          {inputProducts.length > 0 && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
              {inputProducts.length} sản phẩm
            </span>
          )}
        </h4>

        <div className="space-y-3">
          <ProductAutocomplete
            value={currentInput.gtin}
            onChange={(gtin, name) => setCurrentInput({ ...currentInput, gtin, name })}
            accessToken={accessToken}
            placeholder="Tìm nguyên liệu..."
          />

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Số lượng"
              value={currentInput.quantity || ''}
              onChange={(e) => setCurrentInput({ ...currentInput, quantity: parseFloat(e.target.value) })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <select
              value={currentInput.uom}
              onChange={(e) => setCurrentInput({ ...currentInput, uom: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
              <option value="pieces">cái</option>
            </select>
            <button
              onClick={handleAddInput}
              disabled={!currentInput.gtin || currentInput.quantity <= 0}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Thêm
            </button>
          </div>
        </div>

        {/* Input Product List */}
        {inputProducts.length > 0 && (
          <div className="mt-3 space-y-2">
            {inputProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{product.name}</p>
                  <p className="text-xs text-gray-600">
                    {product.quantity} {product.uom}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveInput(index)}
                  className="text-red-500 hover:text-red-700 text-sm px-2"
                >
                  Xóa
                </button>
              </div>
            ))}
            <div className="border-t pt-2 mt-2">
              <p className="text-sm font-semibold text-gray-700">
                Tổng: {calculateTotalInput()} kg
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Output Products Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          📤 Sản phẩm đầu ra
          {outputProducts.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {outputProducts.length} sản phẩm
            </span>
          )}
        </h4>

        <div className="space-y-3">
          <ProductAutocomplete
            value={currentOutput.gtin}
            onChange={(gtin, name) => setCurrentOutput({ ...currentOutput, gtin, name })}
            accessToken={accessToken}
            placeholder="Tìm sản phẩm..."
          />

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Số lượng"
              value={currentOutput.quantity || ''}
              onChange={(e) => setCurrentOutput({ ...currentOutput, quantity: parseFloat(e.target.value) })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={currentOutput.uom}
              onChange={(e) => setCurrentOutput({ ...currentOutput, uom: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
              <option value="pieces">cái</option>
            </select>
            <button
              onClick={handleAddOutput}
              disabled={!currentOutput.gtin || currentOutput.quantity <= 0}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Thêm
            </button>
          </div>
        </div>

        {/* Output Product List */}
        {outputProducts.length > 0 && (
          <div className="mt-3 space-y-2">
            {outputProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{product.name}</p>
                  <p className="text-xs text-gray-600">
                    {product.quantity} {product.uom}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveOutput(index)}
                  className="text-red-500 hover:text-red-700 text-sm px-2"
                >
                  Xóa
                </button>
              </div>
            ))}
            <div className="border-t pt-2 mt-2">
              <p className="text-sm font-semibold text-gray-700">
                Tổng: {calculateTotalOutput()} kg
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Conversion Factor Display */}
      {inputProducts.length > 0 && outputProducts.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Hệ số chuyển đổi</p>
              <p className="text-2xl font-bold text-purple-700">{calculateConversionFactor()}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600">Đầu vào</p>
              <p className="text-lg font-semibold text-emerald-600">{calculateTotalInput()} kg</p>
              <p className="text-xs text-gray-600 mt-1">Đầu ra</p>
              <p className="text-lg font-semibold text-blue-600">{calculateTotalOutput()} kg</p>
            </div>
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <input
          type="text"
          placeholder="GLN vị trí (13 chữ số)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />

        <select
          value={productType}
          onChange={(e) => setProductType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Chọn loại chế biến (tùy chọn)</option>
          <option value="fresh_to_dried_fruit">Trái cây tươi → Sấy khô</option>
          <option value="raw_coffee_to_roasted">Cà phê nhân → Rang xay</option>
          <option value="fresh_mango_to_juice">Xoài tươi → Nước ép</option>
          <option value="raw_to_processed_meat">Thịt sống → Chế biến</option>
        </select>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={loading || inputProducts.length === 0 || outputProducts.length === 0 || !location}
        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-lg"
      >
        {loading ? 'Đang xử lý...' : '✓ Ghi nhận sự kiện chế biến'}
      </button>
    </div>
  )
}
