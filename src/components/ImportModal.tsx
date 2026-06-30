import React, { useRef } from 'react';
import { FileUp, X, FileSpreadsheet, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface ImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadFormat = () => {
    const template = [
      {
        'ID_BARCODE': '12345678',
        'NOMBRE': 'PRODUCTO EJEMPLO',
        'CATEGORIA': 'BEBIDAS',
        'PRECIO_VENTA': 1500,
        'STOCK_INICIAL': 10,
        'COSTO_INICIAL': 800
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
    XLSX.writeFile(workbook, "formato_importacion_fastpos.xlsx");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Map Excel headers to API format
        const products = jsonData.map(row => ({
          id: String(row.ID_BARCODE || ''),
          name: String(row.NOMBRE || ''),
          type: String(row.CATEGORIA || ''),
          sale_price: parseFloat(row.PRECIO_VENTA || 0),
          initial_stock: parseInt(row.STOCK_INICIAL || 0),
          cost: parseFloat(row.COSTO_INICIAL || 0)
        })).filter(p => p.id && p.name);

        const res = await fetch('/api/products/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products })
        });

        if (res.ok) {
          toast.success('Inventario importado correctamente');
          onSuccess();
        } else {
          toast.error('Error al importar');
        }
      } catch (err) {
        toast.error('Archivo Excel inválido');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white border border-[var(--line)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--ink)] text-white">
          <h3 className="font-bold uppercase tracking-widest text-sm flex items-center gap-2">
            <FileUp size={18} /> Importar Inventario
          </h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="p-8 space-y-6">
          <div className="p-6 bg-blue-50 border border-blue-100 rounded-xl">
            <h4 className="font-bold text-blue-900 text-xs uppercase mb-2">Paso 1: Descargar Formato</h4>
            <p className="text-xs text-blue-700 mb-4">Descargue la plantilla de Excel para completar los datos de sus productos correctamente.</p>
            <button
              onClick={downloadFormat}
              className="w-full flex items-center justify-center gap-2 bg-white border border-blue-200 text-blue-700 py-3 rounded-lg font-bold uppercase text-[10px] hover:bg-blue-100 transition-all"
            >
              <FileSpreadsheet size={16} /> Descargar Plantilla .xlsx
            </button>
          </div>

          <div className="p-6 bg-gray-50 border border-gray-100 rounded-xl">
            <h4 className="font-bold text-gray-900 text-xs uppercase mb-2">Paso 2: Cargar Archivo</h4>
            <p className="text-xs text-gray-600 mb-4">Una vez completada la plantilla, súbala aquí para actualizar el inventario.</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-[var(--primary)] text-white py-3 rounded-lg font-bold uppercase text-[10px] hover:opacity-90 transition-all"
            >
              <Upload size={16} /> Seleccionar Archivo
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".xlsx, .xls"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
