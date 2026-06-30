import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Download, 
  Minus, 
  ShoppingCart 
} from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../lib/utils';
import { Product } from './Types';

interface QuotesViewProps {
  products: Product[];
}

// --- Search Normalization Utilities ---
const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const matchProduct = (product: Product, query: string): boolean => {
  const queryNormalized = normalizeString(query).trim();
  if (!queryNormalized) return false;
  
  const queryTokens = queryNormalized.split(/\s+/);
  const nameNormalized = normalizeString(product.name);
  const idNormalized = normalizeString(product.id);
  
  return queryTokens.every(token => 
    nameNormalized.includes(token) || idNormalized.includes(token)
  );
};

const matchCustomer = (customer: any, query: string): boolean => {
  const queryNormalized = normalizeString(query).trim();
  if (!queryNormalized) return false;
  
  const queryTokens = queryNormalized.split(/\s+/);
  const fullNameNormalized = normalizeString(`${customer.first_name || ''} ${customer.last_name || ''}`);
  const rutNormalized = normalizeString(customer.rut || '');
  const contactNormalized = normalizeString(customer.contact || '');
  
  return queryTokens.every(token => 
    fullNameNormalized.includes(token) || 
    rutNormalized.includes(token) ||
    contactNormalized.includes(token)
  );
};

export function QuotesView({ products }: QuotesViewProps) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<'list' | 'editor'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Autocomplete customer support
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);

  // Editor states
  const [clientName, setClientName] = useState('');
  const [clientRut, setClientRut] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [condition, setCondition] = useState('Contado - CLP');
  const [validityDays, setValidityDays] = useState('30');
  const [glosa, setGlosa] = useState('');
  
  // POS Cart
  const [cart, setCart] = useState<any[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);

  const fetchQuotes = async () => {
    try {
      const res = await fetch('/api/quotes');
      if (res.ok) {
        setQuotes(await res.json());
      }
    } catch (e) {
      toast.error("Error al cargar cotizaciones");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers?type=cliente');
      if (res.ok) {
        setCustomers(await res.json());
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchQuotes();
    fetchCustomers();
  }, []);

  const openCreator = () => {
    setEditingId(null);
    setClientName('');
    setClientRut('');
    setClientContact('');
    setClientPhone('');
    setClientEmail('');
    setCondition('Contado - CLP');
    setValidityDays('30');
    setGlosa('');
    setCart([]);
    setProductQuery('');
    setCustomerSearch('');
    setSelectedCustomerIndex(-1);
    setSelectedProductIndex(-1);
    setScreen('editor');
  };

  const openEditor = async (quoteId: number) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (res.ok) {
        const quote = await res.json();
        setEditingId(quote.id);
        setClientName(quote.client_name);
        setClientRut(quote.client_rut || '');
        setClientContact(quote.client_contact || '');
        setClientPhone(quote.client_phone || '');
        setClientEmail(quote.client_email || '');
        setCondition(quote.condition);
        setValidityDays(quote.validity_days.toString());
        setGlosa(quote.glosa || '');
        
        // Map quote items back to cart
        const mappedCart = quote.items.map((item: any) => {
          const product = products.find(p => p.id === item.product_id) || {
            id: item.product_id || '',
            name: item.name,
            type: '',
            sale_price: item.sale_price,
            active: 1
          } as Product;
          
          return {
            product,
            quantity: item.quantity,
            unit: item.unit,
            sale_price: item.sale_price // local custom price for quote
          };
        });
        setCart(mappedCart);
        setProductQuery('');
        setCustomerSearch('');
        setSelectedCustomerIndex(-1);
        setSelectedProductIndex(-1);
        setScreen('editor');
      } else {
        toast.error("Error al cargar detalles de cotización");
      }
    } catch (e) {
      toast.error("Error de red");
    }
  };

  const handleDelete = async (quoteId: number) => {
    if (!window.confirm("¿Está seguro de eliminar esta cotización? Esta acción es irreversible.")) return;
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Cotización eliminada");
        fetchQuotes();
      } else {
        toast.error("Error al eliminar cotización");
      }
    } catch (e) {
      toast.error("Error de conexión");
    }
  };

  // Autocomplete client selection
  const filteredCustomers = customerSearch.trim() ? customers.filter(c =>
    matchCustomer(c, customerSearch)
  ) : [];

  const selectCustomer = (c: any) => {
    setClientName(`${c.first_name} ${c.last_name}`.trim().toUpperCase());
    setClientRut(c.rut || '');
    setClientContact(c.contact || '');
    setClientPhone(c.phone || '');
    setClientEmail(c.email || '');
    setCustomerSearch(`${c.first_name} ${c.last_name}`.trim());
    setShowCustomerDropdown(false);
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowCustomerDropdown(false);
      setSelectedCustomerIndex(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedCustomerIndex >= 0 && selectedCustomerIndex < filteredCustomers.length) {
        selectCustomer(filteredCustomers[selectedCustomerIndex]);
      } else if (filteredCustomers.length > 0) {
        selectCustomer(filteredCustomers[0]);
      }
      setSelectedCustomerIndex(-1);
    }
  };

  // Cart operations
  const filteredProducts = productQuery.trim() ? products.filter(p =>
    matchProduct(p, productQuery)
  ).slice(0, 5) : [];

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, unit: 'UNID', sale_price: product.sale_price }];
    });
    setProductQuery('');
    setSelectedProductIndex(-1);
  };

  const handleProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedProductIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedProductIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setProductQuery('');
      setSelectedProductIndex(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedProductIndex >= 0 && selectedProductIndex < filteredProducts.length) {
        addToCart(filteredProducts[selectedProductIndex]);
      } else if (filteredProducts.length > 0) {
        addToCart(filteredProducts[0]);
      }
      setSelectedProductIndex(-1);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const currentQty = typeof item.quantity === 'number' ? item.quantity : 0;
        return { ...item, quantity: Math.max(1, currentQty + delta) };
      }
      return item;
    }));
  };

  const updateCartUnit = (productId: string, unit: string) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, unit: unit.toUpperCase() };
      }
      return item;
    }));
  };

  const updateCartPrice = (productId: string, price: string) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const parsed = parseFloat(price);
        return { ...item, sale_price: isNaN(parsed) ? 0 : parsed };
      }
      return item;
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) {
      toast.error("Debe ingresar el nombre del cliente");
      return;
    }
    if (cart.length === 0) {
      toast.error("Debe agregar al menos un item");
      return;
    }

    const payload = {
      client_name: clientName,
      client_rut: clientRut,
      client_contact: clientContact,
      client_phone: clientPhone,
      client_email: clientEmail,
      condition,
      validity_days: parseInt(validityDays, 10) || 30,
      glosa,
      items: cart.map(item => ({
        product_id: item.product.id || null,
        name: item.product.name,
        quantity: item.quantity,
        unit: item.unit,
        sale_price: item.sale_price
      }))
    };

    try {
      const url = editingId ? `/api/quotes/${editingId}` : '/api/quotes';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingId ? "Cotización actualizada" : "Cotización creada");
        setScreen('list');
        fetchQuotes();
        // Auto trigger download for new quotes
        if (!editingId && data.id) {
          downloadQuotePDF(data.id);
        }
      } else {
        toast.error(data.error || "Error al guardar cotización");
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  const downloadQuotePDF = async (quoteId: number) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (!res.ok) throw new Error("No se pudo cargar la cotización");
      const quote = await res.json();

      const configRes = await fetch('/api/company-settings');
      let issuer = {
        company_name: '',
        company_rut: '',
        company_address: '',
        company_phone: '',
        company_email: '',
        company_bank_details: '',
        company_logo: ''
      };
      if (configRes.ok) {
        const data = await configRes.json();
        issuer = { ...issuer, ...data };
      }

      // Calculate logo dimensions keeping aspect ratio (max 45w x 18h)
      let logoWidth = 35;
      let logoHeight = 15;
      if (issuer.company_logo) {
        try {
          const img = new Image();
          img.src = issuer.company_logo;
          await new Promise((resolve) => {
            img.onload = () => {
              const ratio = img.naturalWidth / img.naturalHeight;
              const maxW = 45;
              const maxH = 18;
              if (ratio > maxW / maxH) {
                logoWidth = maxW;
                logoHeight = maxW / ratio;
              } else {
                logoHeight = maxH;
                logoWidth = maxH * ratio;
              }
              resolve(null);
            };
            img.onerror = () => {
              resolve(null);
            };
          });
        } catch (e) {
          console.error("Error reading logo dimensions:", e);
        }
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      // Draw custom logo if uploaded, otherwise fallback to issuing company name
      let detailsStartY = 24;
      if (issuer.company_logo) {
        try {
          doc.addImage(issuer.company_logo, 'PNG', 15, 11, logoWidth, logoHeight, undefined, 'FAST');
          const logoBottomY = 11 + logoHeight;
          detailsStartY = Math.max(30, logoBottomY + 3);
        } catch (err) {
          console.error("Error drawing company logo, falling back to company name:", err);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.setTextColor(0, 94, 184); // Premium blue
          doc.text(issuer.company_name.toUpperCase(), 15, 18);
          detailsStartY = 24;
        }
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(0, 94, 184); // Premium blue
        doc.text(issuer.company_name.toUpperCase(), 15, 18);
        detailsStartY = 24;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text(issuer.company_address.toUpperCase(), 15, detailsStartY);

      let phoneEmailText = `TELÉFONO: ${issuer.company_phone}`;
      if (issuer.company_email) {
        phoneEmailText += `    |    EMAIL: ${issuer.company_email.toLowerCase()}`;
      }
      doc.text(phoneEmailText, 15, detailsStartY + 4);

      // Blue Box for COTIZACIÓN (Centering headers)
      doc.setDrawColor(0, 94, 184);
      doc.setLineWidth(0.6);
      
      const nameLines = doc.splitTextToSize(issuer.company_name.toUpperCase(), 64);
      const boxHeightTop = 23 + (nameLines.length * 3.5);
      doc.rect(130, 10, 70, boxHeightTop);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(0, 94, 184);
      doc.text("COTIZACIÓN", 165, 16, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.text(`Folio Nº ${quote.id}`, 165, 21.5, { align: 'center' });
      doc.text(issuer.company_rut, 165, 26.5, { align: 'center' });
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      let currentBoxY = 31.5;
      nameLines.forEach((line: string) => {
        doc.text(line, 165, currentBoxY, { align: 'center' });
        currentBoxY += 3.5;
      });

      // Client Box (Prevent text overlaps)
      doc.setDrawColor(0, 94, 184);
      doc.setLineWidth(0.3);
      doc.setFillColor(255, 255, 255);
      
      const hasGlosa = !!quote.glosa;
      const boxHeight = hasGlosa ? 32 : 27.5;
      doc.rect(15, 45, 185, boxHeight);

      doc.setFillColor(240, 245, 255);
      doc.rect(15.1, 45.1, 184.8, 6.2, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 94, 184);
      doc.text(`${quote.client_rut || 'SIN RUT'}    /    ${quote.client_name.toUpperCase()}`, 18, 49.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);

      // Left Column: Customer details
      doc.setFont("helvetica", "bold");
      doc.text("Contacto:", 17, 55);
      doc.setFont("helvetica", "normal");
      const contactVal = quote.client_contact || quote.client_name;
      doc.text(contactVal.substring(0, 45).toUpperCase(), 42, 55);
      
      doc.setFont("helvetica", "bold");
      doc.text("Teléfono:", 17, 59.5);
      doc.setFont("helvetica", "normal");
      doc.text(quote.client_phone || 'NO ESPECIFICADO', 42, 59.5);

      doc.setFont("helvetica", "bold");
      doc.text("Email:", 17, 64);
      doc.setFont("helvetica", "normal");
      doc.text(quote.client_email || 'NO ESPECIFICADO', 42, 64);

      doc.setFont("helvetica", "bold");
      doc.text("Dirección:", 17, 68.5);
      doc.setFont("helvetica", "normal");
      doc.text((quote.client_address || 'NO ESPECIFICADA').toUpperCase(), 42, 68.5);

      // Right Column: Quote commercial details
      doc.setFont("helvetica", "bold");
      doc.text("Condición:", 112, 55);
      doc.setFont("helvetica", "normal");
      doc.text(quote.condition.toUpperCase(), 138, 55);

      const issueDate = new Date(quote.created_at);
      const validityVal = parseInt(quote.validity_days, 10) || 30;
      const validDate = new Date(issueDate.getTime() + validityVal * 24 * 60 * 60 * 1000);
      const formatD = (d: Date) => d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

      doc.setFont("helvetica", "bold");
      doc.text("Emisión:", 112, 59.5);
      doc.setFont("helvetica", "normal");
      doc.text(formatD(issueDate), 138, 59.5);

      doc.setFont("helvetica", "bold");
      doc.text("Valido hasta:", 112, 64);
      doc.setFont("helvetica", "normal");
      doc.text(formatD(validDate), 138, 64);

      if (hasGlosa) {
        doc.setFont("helvetica", "bold");
        doc.text("Glosa:", 17, 73);
        doc.setFont("helvetica", "normal");
        const glosaText = quote.glosa.substring(0, 80);
        doc.text(glosaText.toUpperCase(), 42, 73);
      }

      // Items Table
      const headers = [["Detalle", "Cant.", "Uni.", "Neto", "Total"]];
      let netSubtotal = 0;

      const tableRows = quote.items.map((item: any) => {
        const grossUnitPrice = item.sale_price;
        const netUnitPrice = grossUnitPrice / 1.19;
        const itemNetTotal = item.quantity * netUnitPrice;
        netSubtotal += itemNetTotal;

        const formatCurrency = (val: number) => {
          return val.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        };

        return [
          item.name.toUpperCase(),
          item.quantity.toString(),
          item.unit.toUpperCase(),
          formatCurrency(netUnitPrice),
          formatCurrency(itemNetTotal)
        ];
      });

      const formatCurrencyFull = (val: number) => {
        return Math.round(val).toLocaleString('es-CL') + " CLP";
      };

      const tax = netSubtotal * 0.19;
      const grossTotal = netSubtotal + tax;

      autoTable(doc, {
        head: headers,
        body: tableRows,
        startY: hasGlosa ? 81 : 76,
        margin: { left: 15, right: 15 },
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          valign: 'middle',
          lineColor: [180, 180, 180],
          lineWidth: 0.2
        },
        headStyles: {
          fillColor: [240, 245, 255],
          textColor: [0, 94, 184],
          fontStyle: 'bold',
          lineWidth: 0.2,
          lineColor: [0, 94, 184]
        },
        columnStyles: {
          0: { cellWidth: 'auto', fontStyle: 'bold' },
          1: { cellWidth: 15, halign: 'center' },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
        },
        didDrawPage: (data) => {
          const finalY = data.cursor ? data.cursor.y : 150;
          let currentY = finalY + 5;
          if (currentY > 215) {
            doc.addPage();
            currentY = 20;
          }

          // Disclaimer (left)
          doc.setFont("helvetica", "italic");
          doc.setFontSize(6);
          doc.setTextColor(110, 110, 110);
          const disclaimer = "Se reserva el derecho de cambiar o modificar su lista de precios sin previo aviso, corregir irregularidades u otros generados por sus empleados. En caso de una variación muy alta del dólar, será necesario volver a recalcular los valores cotizados.";
          const disclaimerLines = doc.splitTextToSize(disclaimer, 110);
          doc.text(disclaimerLines, 15, currentY);

          // Totals block (right)
          doc.setDrawColor(0, 94, 184);
          doc.setLineWidth(0.2);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(0, 0, 0);

          doc.text("Neto:", 135, currentY + 3);
          doc.text(formatCurrencyFull(netSubtotal), 195, currentY + 3, { align: 'right' });
          doc.line(130, currentY + 4.5, 200, currentY + 4.5);

          doc.text("IVA(19%):", 135, currentY + 8);
          doc.text(formatCurrencyFull(tax), 195, currentY + 8, { align: 'right' });
          doc.line(130, currentY + 9.5, 200, currentY + 9.5);

          doc.text("Total:", 135, currentY + 13);
          doc.text(formatCurrencyFull(grossTotal), 195, currentY + 13, { align: 'right' });

          doc.rect(130, currentY, 70, 16);

          // Bank Details
          currentY += 20;
          doc.setDrawColor(200, 200, 200);
          
          const bankLines = doc.splitTextToSize(issuer.company_bank_details, 150);
          const bankBoxHeight = Math.max(14, (bankLines.length * 3.5) + 3);
          
          doc.rect(15, currentY, 185, bankBoxHeight);
          doc.setFillColor(245, 245, 245);
          doc.rect(15.1, currentY + 0.1, 23.8, bankBoxHeight - 0.2, 'F');
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          
          const labelOffsetY = (bankBoxHeight / 2) - 1.55;
          doc.text("Datos", 17, currentY + labelOffsetY);
          doc.text("Bancarios:", 17, currentY + labelOffsetY + 3.5);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.text(bankLines, 41, currentY + 4);
        }
      });

      const filename = `CT${quote.id}_${quote.client_name.replace(/\s+/g, '_').toUpperCase()}.pdf`;
      doc.save(filename);
      toast.success("PDF descargado correctamente");
    } catch (error: any) {
      toast.error(error.message || "Error al descargar PDF");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">Cargando módulo de cotizaciones...</div>;
  }

  const calculateTotal = () => {
    return cart.reduce((acc, item) => acc + (item.sale_price * item.quantity), 0);
  };

  return (
    <div className="h-full flex flex-col">
      {screen === 'list' ? (
        <div className="p-8 max-w-5xl mx-auto space-y-8 w-full">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Gestión de Cotizaciones</h2>
              <p className="text-sm text-gray-500 mt-1">Cree y administre presupuestos formales para sus clientes.</p>
            </div>
            <button
              onClick={openCreator}
              className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-blue-100 flex items-center gap-2"
            >
              <Plus size={16} /> Nueva Cotización
            </button>
          </div>

          <div className="border border-[var(--line)] bg-white rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-[80px_2.5fr_1.5fr_1.2fr_1.5fr] p-4 border-b border-[var(--line)] bg-gray-50/50 text-xs font-bold uppercase text-gray-500">
              <div>Folio</div>
              <div>Cliente</div>
              <div>Fecha</div>
              <div className="text-right">Total Neto</div>
              <div className="text-center">Acciones</div>
            </div>
            <div className="divide-y divide-[var(--line)] max-h-[500px] overflow-auto">
              {quotes.map((q: any) => {
                const netAmount = q.total_amount / 1.19;
                return (
                  <div key={q.id} className="grid grid-cols-[80px_2.5fr_1.5fr_1.2fr_1.5fr] p-4 text-sm items-center hover:bg-gray-50/50 transition-colors">
                    <div className="font-mono font-bold text-gray-400">#{q.id}</div>
                    <div className="font-bold uppercase truncate pr-4">{q.client_name}</div>
                    <div className="text-gray-500 font-mono text-xs">{new Date(q.created_at).toLocaleDateString()}</div>
                    <div className="text-right font-mono font-bold text-[var(--ink)]">${Math.round(netAmount).toLocaleString()}</div>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => downloadQuotePDF(q.id)}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                        title="Descargar PDF"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => openEditor(q.id)}
                        className="p-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {quotes.length === 0 && (
                <div className="p-8 text-center text-gray-400 italic text-sm">No hay cotizaciones registradas.</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 h-full overflow-hidden">
          {/* Quote creator left: Customer details and header parameters */}
          <div className="w-2/5 border-r border-[var(--line)] bg-white p-6 overflow-y-auto flex flex-col space-y-6">
            <div>
              <h3 className="text-xl font-bold uppercase tracking-wide">{editingId ? `Editar Cotización #${editingId}` : 'Detalles de Cotización'}</h3>
              <p className="text-xs text-gray-400 mt-0.5">Defina el cliente y condiciones comerciales.</p>
            </div>

            {/* Customer Lookup Autocomplete */}
            <div className="relative">
              <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Buscar Cliente Registrado (Autocomplete)</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Escriba nombre o RUT..."
                  value={customerSearch}
                  onChange={e => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                    setSelectedCustomerIndex(-1);
                  }}
                  onKeyDown={handleCustomerKeyDown}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full bg-gray-50 border border-[var(--line)] py-2 pl-9 pr-4 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                />
              </div>

              {showCustomerDropdown && customerSearch && (
                <div className="absolute top-full left-0 w-full bg-white border border-[var(--line)] rounded-xl shadow-2xl z-20 max-h-40 overflow-y-auto mt-1">
                  {filteredCustomers.map((c, index) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className={cn(
                        "w-full text-left p-2.5 text-xs hover:bg-gray-100 border-b last:border-0 border-gray-100 flex justify-between uppercase transition-colors",
                        index === selectedCustomerIndex ? "bg-blue-50 text-[var(--primary)] border-l-4 border-l-[var(--primary)]" : "bg-white text-gray-700"
                      )}
                    >
                      <span className="font-bold">{c.first_name} {c.last_name}</span>
                      <span className="text-gray-400 font-mono">{c.rut || 'SIN RUT'}</span>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="p-2 text-center text-xs text-gray-400 italic">No se encontraron clientes</div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Razón Social / Nombre Cliente *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={e => setClientName(e.target.value.toUpperCase())}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">RUT Cliente</label>
                  <input
                    type="text"
                    value={clientRut}
                    onChange={e => setClientRut(e.target.value)}
                    placeholder="E.g. 78.065.264-0"
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Persona de Contacto</label>
                  <input
                    type="text"
                    value={clientContact}
                    onChange={e => setClientContact(e.target.value)}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Teléfono Cliente</label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Email Cliente</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Condición Pago</label>
                  <input
                    type="text"
                    required
                    value={condition}
                    onChange={e => setCondition(e.target.value)}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20 uppercase"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Días de Validez</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={validityDays}
                    onChange={e => setValidityDays(e.target.value)}
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Glosa / Observación (Opcional)</label>
                  <input
                    type="text"
                    value={glosa}
                    onChange={e => setGlosa(e.target.value)}
                    placeholder="Nota que aparecerá en el PDF..."
                    className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 ring-[var(--primary)]/20"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setScreen('list')}
                  className="flex-1 border border-[var(--line)] py-3 rounded-xl font-bold uppercase text-xs hover:bg-gray-50 transition-colors text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[var(--primary)] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[var(--primary-dark)] shadow-md shadow-blue-100 transition-all text-center"
                >
                  {editingId ? 'Guardar Cambios' : 'Guardar y PDF'}
                </button>
              </div>
            </form>
          </div>

          {/* Quote creator right: Search & cart POS items */}
          <div className="flex-1 bg-gray-50 p-6 flex flex-col h-full overflow-hidden">
            <div className="mb-4">
              <h4 className="font-bold text-sm text-[var(--ink)] uppercase">Comanda de Cotización</h4>
              <p className="text-xs text-gray-500">Agregue productos del catálogo al presupuesto.</p>
            </div>

            {/* Product search input */}
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={productQuery}
                onChange={e => {
                  setProductQuery(e.target.value);
                  setSelectedProductIndex(-1);
                }}
                onKeyDown={handleProductKeyDown}
                placeholder="BUSCAR O ESCANEAR PRODUCTO..."
                className="w-full bg-white border border-[var(--line)] py-3 pl-10 pr-4 text-xs font-semibold rounded-xl shadow-sm focus:outline-none focus:ring-2 ring-[var(--primary)]/20 transition-all uppercase"
              />
              
              {productQuery && filteredProducts.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-[var(--line)] border-t-0 shadow-2xl z-20 rounded-b-xl overflow-hidden">
                  {filteredProducts.map((p, index) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className={cn(
                        "w-full flex items-center justify-between p-3.5 hover:bg-gray-100 transition-colors text-left border-b border-gray-100 last:border-0",
                        index === selectedProductIndex ? "bg-blue-50 text-[var(--primary)] border-l-4 border-l-[var(--primary)]" : "bg-white text-gray-700"
                      )}
                    >
                      <div>
                        <div className="font-bold uppercase text-xs">{p.name}</div>
                        <div className="text-[9px] font-mono opacity-50">SKU: {p.id} // STOCK: {p.total_stock}</div>
                      </div>
                      <div className="font-mono text-sm font-bold">${p.sale_price.toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart list */}
            <div className="flex-1 overflow-auto space-y-3 pr-1 bg-white border border-[var(--line)] rounded-2xl p-4">
              {cart.map((item, i) => {
                const subtotal = item.sale_price * item.quantity;
                return (
                  <div key={item.product.id || i} className="p-3 border border-[var(--line)] rounded-xl flex items-center justify-between gap-4 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold uppercase text-xs truncate">{item.product.name}</div>
                      <div className="text-[9px] font-mono text-gray-400 mt-0.5">SKU: {item.product.id || 'N/A'}</div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-white border border-gray-200 rounded-lg p-1">
                      <button onClick={() => updateCartQty(item.product.id, -1)} className="p-1 hover:bg-gray-100 rounded text-gray-500"><Minus size={12} /></button>
                      <span className="font-mono text-xs font-bold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.product.id, 1)} className="p-1 hover:bg-gray-100 rounded text-gray-500"><Plus size={12} /></button>
                    </div>

                    {/* Unit type input */}
                    <div className="w-16 shrink-0">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={e => updateCartUnit(item.product.id, e.target.value)}
                        placeholder="UNID"
                        className="w-full text-center bg-white border border-gray-200 py-1 text-xs rounded-lg font-bold uppercase focus:outline-none"
                      />
                    </div>

                    {/* Unit price input */}
                    <div className="w-24 shrink-0 flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                      <span className="text-gray-400 text-xs font-bold">$</span>
                      <input
                        type="number"
                        value={item.sale_price}
                        onChange={e => updateCartPrice(item.product.id, e.target.value)}
                        className="w-full font-mono text-xs font-bold focus:outline-none"
                      />
                    </div>

                    {/* Line total */}
                    <div className="w-20 text-right font-mono text-xs font-bold text-[var(--primary)] shrink-0">
                      ${subtotal.toLocaleString()}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
              {cart.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 italic text-xs py-12">
                  <ShoppingCart size={32} className="opacity-20 mb-2" />
                  <span>No hay productos en esta cotización</span>
                </div>
              )}
            </div>

            {/* Summary total footer */}
            <div className="mt-4 p-4 bg-white border border-[var(--line)] rounded-2xl flex justify-between items-center shrink-0 shadow-sm">
              <div>
                <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Total Cotizado (Neto + IVA)</span>
                <div className="text-xs text-gray-500 font-medium">Neto: ${Math.round(calculateTotal() / 1.19).toLocaleString()} // IVA: ${Math.round((calculateTotal() / 1.19) * 0.19).toLocaleString()}</div>
              </div>
              <div className="text-2xl font-mono font-bold text-[var(--primary)]">
                ${calculateTotal().toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
