'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Client } from '@/types';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface ClientFormProps {
  onSubmit: (client: Client) => void;
  loading?: boolean;
  initialClient?: Client;
  storageKeyPrefix: string; // 'distriNaranjos1' or 'distriNaranjos2'
}

export default function ClientForm({ onSubmit, loading = false, initialClient, storageKeyPrefix }: ClientFormProps) {
  const [client, setClient] = useState<Client>(() => initialClient || {
    companyName: '',
    identification: '',
    name: '',
    surname: '',
    phone: '',
    address: '',
    city: '',
    department: '',
    comentario: ''
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [savedClients, setSavedClients] = useState<Client[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [searchClient, setSearchClient] = useState('');
  // Add this ref for the file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('Todos');
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Position dropdown relative to button
  const positionDropdown = () => {
    if (!showDropdown || !dropdownRef.current || !buttonRef.current) return;

    const button = buttonRef.current;
    const dropdown = dropdownRef.current;
    
    const buttonRect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate available space
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    const spaceRight = viewportWidth - buttonRect.right;
    const spaceLeft = buttonRect.left;
    
    // Set max width for mobile
    const maxWidth = Math.min(256, viewportWidth - 32); // 256px = w-64, 32px = 2rem padding
    dropdown.style.maxWidth = `${maxWidth}px`;
    
    // Position horizontally - ensure dropdown stays within screen bounds
    const dropdownWidth = Math.min(maxWidth, 256); // Use the calculated maxWidth
    const rightEdge = buttonRect.left + dropdownWidth;
    
    if (rightEdge > viewportWidth) {
      // Dropdown would exceed screen width, position it to the right edge
      dropdown.style.left = `${viewportWidth - dropdownWidth - 16}px`; // 16px margin
      dropdown.style.right = 'auto';
      dropdown.style.transform = 'none';
    } else {
      // Dropdown fits, position it at button's left edge
      dropdown.style.left = `${buttonRect.left}px`;
      dropdown.style.right = 'auto';
      dropdown.style.transform = 'none';
    }
    
    // Position vertically
    if (spaceBelow >= 384 || spaceBelow > spaceAbove) { // 384px = 24rem maxHeight
      // Position below button
      dropdown.style.top = `${buttonRect.bottom + 8}px`;
      dropdown.style.bottom = 'auto';
    } else {
      // Position above button
      dropdown.style.bottom = `${viewportHeight - buttonRect.top + 8}px`;
      dropdown.style.top = 'auto';
    }
  };

  // Position dropdown when it opens
  useEffect(() => {
    if (showDropdown) {
      // Position immediately and after a small delay to handle any layout changes
      positionDropdown();
      const timeoutId = setTimeout(positionDropdown, 10);
      return () => clearTimeout(timeoutId);
    }
  }, [showDropdown]);

  // Add scroll and resize listeners when dropdown is open
  useEffect(() => {
    if (!showDropdown) return;

    let scrollHandler: number;
    let resizeHandler: number;
    
    const handleScroll = () => {
      if (scrollHandler) {
        cancelAnimationFrame(scrollHandler);
      }
      scrollHandler = requestAnimationFrame(() => {
        // Add a small delay to reduce shakiness
        setTimeout(positionDropdown, 10);
      });
    };
    
    const handleResize = () => {
      if (resizeHandler) {
        cancelAnimationFrame(resizeHandler);
      }
      resizeHandler = requestAnimationFrame(positionDropdown);
    };
    
    // Listen to all scroll events that might affect positioning
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    // Cleanup listeners
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      document.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleResize);
      if (scrollHandler) {
        cancelAnimationFrame(scrollHandler);
      }
      if (resizeHandler) {
        cancelAnimationFrame(resizeHandler);
      }
    };
  }, [showDropdown]);

  useEffect(() => {
    if (initialClient) {
      setClient({
        companyName: initialClient.companyName || '',
        identification: initialClient.identification || '',
        name: initialClient.name || '',
        surname: initialClient.surname || '',
        phone: initialClient.phone || '',
        address: initialClient.address || '',
        city: initialClient.city || '',
        department: initialClient.department || '',
        comentario: initialClient.comentario || ''
      });
    }
  }, [initialClient]);

  // Helper: Ensure all client fields are present
  const sanitizeClient = (c: any): Client => ({
    companyName: String(c.companyName ?? ''),
    identification: String(c.identification ?? ''),
    name: String(c.name ?? ''),
    surname: String(c.surname ?? ''),
    phone: String(c.phone ?? ''),
    address: String(c.address ?? ''),
    city: String(c.city ?? ''),
    department: String(c.department ?? ''),
    comentario: String(c.comentario ?? '')
  });

  // Load saved clients from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const clientsStr = localStorage.getItem(`${storageKeyPrefix}_saved_clients`);
      if (clientsStr) {
        // Ensure all fields are present
        const loadedClients = JSON.parse(clientsStr).map((c: any) => sanitizeClient(c));
        console.log('Loaded clients from localStorage:', loadedClients);
        setSavedClients(loadedClients);
      }
    }
  }, [storageKeyPrefix]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(client);
  };

  const handleInputChange = (field: keyof Client, value: string) => {
    setClient(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save client to localStorage (add to list, but exclude comentario)
  const handleSaveClient = () => {
    try {
      const clientsStr = localStorage.getItem(`${storageKeyPrefix}_saved_clients`);
      let clients: Client[] = clientsStr ? JSON.parse(clientsStr).map((c: any) => {
        const { comentario, ...rest } = c;
        return rest;
      }) : [];
      // Exclude comentario from the saved object
      const { comentario, ...clientToSave } = client;
      console.log('Saving client (without comentario):', clientToSave);
      // Avoid duplicates by identification or companyName
      if (!clients.some(c => c.identification === clientToSave.identification && c.companyName === clientToSave.companyName)) {
        clients.push(clientToSave);
        localStorage.setItem(`${storageKeyPrefix}_saved_clients`, JSON.stringify(clients));
        setSavedClients(clients);
        toast.success('Cliente guardado correctamente.');
      } else {
        toast.error('Este cliente ya está guardado.');
      }
    } catch (e) {
      toast.error('Error al guardar el cliente.');
    }
  };

  // Show dropdown of saved clients
  const handleShowDropdown = () => {
    setShowDropdown((prev) => !prev);
  };

  // Load selected client from dropdown (just fill fields, do not submit)
  const handleSelectClient = (selected: Client) => {
    setClient(selected);
    setShowDropdown(false);
    toast.success('Cliente cargado correctamente.');
  };

  // Delete a client from saved list with custom modal
  const handleDeleteClient = (clientToDelete: Client) => {
    setClientToDelete(clientToDelete);
    setShowDeleteModal(true);
  };

  const confirmDeleteClient = () => {
    if (clientToDelete) {
      const filtered = savedClients.filter(
        c => !(c.identification === clientToDelete.identification && c.companyName === clientToDelete.companyName)
      );
      setSavedClients(filtered);
      localStorage.setItem(`${storageKeyPrefix}_saved_clients`, JSON.stringify(filtered));
      toast.success('Cliente eliminado.');
    }
    setShowDeleteModal(false);
    setClientToDelete(null);
  };

  const cancelDeleteClient = () => {
    setShowDeleteModal(false);
    setClientToDelete(null);
  };

  // Filtered clients for dropdown
  // Helper: Remove accents/diacritics and lowercase
  const normalize = (val: any = '') => {
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      return String(val).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    }
    if (Array.isArray(val) || (val && typeof val === 'object')) {
      console.warn('normalize: non-primitive value encountered', val);
      return '';
    }
    return '';
  };
  // Get unique departments from savedClients
  const uniqueDepartments = Array.from(new Set(savedClients.map(c => c.department).filter(Boolean))).sort((a, b) => (a || '').localeCompare(b || ''));

  // Filtered clients for dropdown (search + department)
  const filteredClients = savedClients.filter(c => {
    const term = normalize(searchClient.trim());
    const matchesSearch = !term || (
      normalize(c.companyName).includes(term) ||
      normalize(c.name).includes(term) ||
      normalize(c.surname).includes(term) ||
      normalize(c.city).includes(term) ||
      normalize(c.department).includes(term) ||
      normalize(c.identification).includes(term)
    );
    const matchesDepartment = selectedDepartment === 'Todos' || c.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });
  console.log('Filtered clients for search:', filteredClients);

  const sortedClients = [...filteredClients].sort((a, b) => {
    const depA = (a.department || '').toLowerCase();
    const depB = (b.department || '').toLowerCase();
    if (depA !== depB) return depA.localeCompare(depB);
    const cityA = (a.city || '').toLowerCase();
    const cityB = (b.city || '').toLowerCase();
    if (cityA !== cityB) return cityA.localeCompare(cityB);
    const compA = (a.companyName || '').toLowerCase();
    const compB = (b.companyName || '').toLowerCase();
    return compA.localeCompare(compB);
  });

  // Handler for Importar Lista button
  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Handler for file input change
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      try {
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        // Only keep the relevant columns and sanitize
        const importedClients = jsonData.map(row => sanitizeClient(row));
        console.log('Imported clients after sanitization:', importedClients);
        // Overwrite existing clients with the imported list
        localStorage.setItem(`${storageKeyPrefix}_saved_clients`, JSON.stringify(importedClients));
        setSavedClients(importedClients);
        toast.success('Lista de clientes importada correctamente.');
      } catch (err) {
        toast.error('No se pudo importar la lista. Asegúrese de que el archivo sea válido.');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="rounded-lg shadow-lg p-6 bg-white">
      {/* Top action bar: Importar Lista (left), Guardar Cliente (next), Lista de Clientes (right) */}
      <div className="flex items-center justify-between mb-2 w-full gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleImportButtonClick}
            className="px-3 py-1 rounded-full text-xs font-medium border bg-gray-300/70 text-black hover:bg-gray-400/80 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
          >
            Importar Lista
          </button>
          <button
            type="button"
            onClick={handleSaveClient}
            className="px-3 py-1 rounded-full text-xs font-medium border bg-green-600 text-white hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400"
            aria-label="Guardar Cliente"
          >
            Guardar Cliente
          </button>
        </div>
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={handleShowDropdown}
            type="button"
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 ${storageKeyPrefix === 'distriNaranjos1' ? 'bg-yellow-100 hover:bg-yellow-200 text-black border-yellow-200' : 'bg-yellow-100 hover:bg-yellow-200 text-black border-yellow-200'}`}
            aria-label="Lista de Clientes"
          >
            Lista de Clientes
            <span className="ml-2 inline-block align-middle">
              <svg className="w-3 h-3 text-gray-500 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </span>
          </button>
          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            ref={fileInputRef}
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
          {showDropdown && typeof window !== 'undefined' && createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-30 w-64 bg-white border-2 border-black rounded-xl shadow-lg focus:outline-none"
              style={{ 
                minWidth: '12rem', 
                maxWidth: 'calc(100vw - 2rem)', 
                maxHeight: '24rem', 
                overflowY: 'auto', 
                padding: 0,
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                top: 'auto',
                left: 'auto',
                right: 'auto'
              }}
            >
                {/* Search input for clients */}
                <div className="sticky top-0 z-20 bg-gradient-to-b from-yellow-50 to-white border-b-2 border-amber-800 px-3 py-2" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-amber-800 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4-4m0 0A7 7 0 104 4a7 7 0 0013 13z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={searchClient}
                      onChange={e => setSearchClient(e.target.value)}
                      placeholder="Buscar clientes ..."
                      className="w-full pl-6 pr-2 py-1 min-h-[36px] text-sm text-black border border-amber-200 ring-2 ring-amber-800 rounded-full bg-white z-30 shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-800 focus:border-amber-900 placeholder-black transition-all"
                    />
                  </div>
                  {/* Dynamic client count display */}
                  <div className="mt-2 mb-1 flex items-center justify-center">
                    <span className="inline-block bg-amber-100 text-amber-900 text-xs font-semibold rounded-full px-3 py-1 border border-amber-200 shadow-sm">
                      {filteredClients.length} cliente{filteredClients.length === 1 ? '' : 's'} listado{filteredClients.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                {/* Department filter bar */}
                <div className="w-full overflow-x-auto py-2 border-b border-gray-200 mb-1">
                  <div className="flex flex-row gap-2 min-w-max px-3">
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-amber-800 ${selectedDepartment === 'Todos' ? 'bg-amber-600 text-white border-amber-600' : 'bg-gray-200 text-gray-800 border-gray-300 hover:bg-gray-300'}`}
                      onClick={() => setSelectedDepartment('Todos')}
                    >
                      Todos
                    </button>
                    {uniqueDepartments.map(dep => (
                      <button
                        key={dep || ''}
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-teal-800 ${selectedDepartment === dep ? 'bg-teal-800 text-white border-teal-800' : 'bg-teal-100 text-teal-900 border-teal-200 hover:bg-teal-200'}`}
                        onClick={() => setSelectedDepartment(dep || '')}
                      >
                        {dep}
                      </button>
                    ))}
                  </div>
                </div>
              {filteredClients.length === 0 ? (
                <div className="px-3 py-2 text-gray-500 text-sm">No hay clientes guardados.</div>
              ) : (
                <ul className="py-1">
                  {filteredClients.map((c, idx) => (
                    <React.Fragment key={idx}>
                      <li className="flex items-center group hover:bg-yellow-50 focus-within:bg-yellow-100 transition-colors">
                        <button
                          type="button"
                          onClick={() => handleSelectClient(c)}
                          className="flex-1 text-left px-3 py-2 focus:bg-yellow-100 focus:outline-none"
                          style={{ minHeight: '2.25rem' }}
                        >
                          <div className="font-semibold text-gray-800 text-sm truncate">{c.companyName || c.name || 'Cliente'}</div>
                          <div className="text-xs text-gray-500 truncate">{[c.name, c.surname].filter(Boolean).join(' ')}</div>
                          <div className="text-xs text-gray-400 truncate">{[c.city, c.department].filter(Boolean).join(' • ')}</div>
                          <div className="text-xs text-gray-400 truncate">{c.phone}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClient(c)}
                          className="p-2 text-gray-400 hover:text-red-600 focus:outline-none"
                          aria-label="Eliminar cliente"
                          tabIndex={0}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                      {idx < filteredClients.length - 1 && (
                        <li className="mx-2 border-b border-gray-200" />
                      )}
                    </React.Fragment>
                  ))}
                </ul>
              )}
            </div>,
            document.body
          )}
        </div>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Información del Cliente</h2>
      
      {/* Seguridad y privacidad - removido por solicitud para distri1/naranjos2 */}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Data Section */}
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Datos del Cliente</h3>
            <button
              type="button"
              onClick={() => {
                setClient({
                  companyName: '',
                  identification: '',
                  name: '',
                  surname: '',
                  phone: '',
                  address: '',
                  city: '',
                  department: '',
                  comentario: ''
                });
              }}
              className="text-red-500 hover:text-red-700 text-sm font-medium"
            >
              Limpiar
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                Empresa / Tienda
              </label>
              <input
                type="text"
                id="companyName"
                name="companyName"
                autoComplete="organization"
                value={client.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-600 focus:border-2 text-red-600 transition-all duration-200 ease-in-out focus:!border-red-600"
                placeholder="Ingrese la empresa o tienda"
                aria-label="Empresa o Tienda"
                aria-required="true"
              />
            </div>

            <div>
              <label htmlFor="identification" className="block text-sm font-medium text-gray-700 mb-1">
                Cédula
              </label>
              <input
                type="text"
                id="identification"
                name="identification"
                autoComplete="off"
                value={client.identification}
                onChange={(e) => handleInputChange('identification', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black focus:border-2 text-black transition-all duration-200 ease-in-out focus:!border-black"
                placeholder="Ingrese la cédula"
                aria-label="Cédula"
                aria-required="true"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre(s)
              </label>
              <input
                type="text"
                id="name"
                name="name"
                autoComplete="given-name"
                value={client.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black focus:border-2 text-black transition-all duration-200 ease-in-out focus:!border-black"
                placeholder="Ingrese el nombre(s)"
                aria-label="Nombre(s)"
                aria-required="true"
              />
            </div>

            <div>
              <label htmlFor="surname" className="block text-sm font-medium text-gray-700 mb-1">
                Apellido(s)
              </label>
              <input
                type="text"
                id="surname"
                name="surname"
                autoComplete="family-name"
                value={client.surname}
                onChange={(e) => handleInputChange('surname', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black focus:border-2 text-black transition-all duration-200 ease-in-out focus:!border-black"
                placeholder="Ingrese el apellido(s)"
                aria-label="Apellido(s)"
                aria-required="true"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                autoComplete="tel"
                value={client.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:border-2 text-blue-600 transition-all duration-200 ease-in-out focus:!border-blue-600"
                placeholder="Ingrese el número de teléfono"
                aria-label="Teléfono"
                aria-required="true"
              />
            </div>
          </div>
        </div>

        {/* Client Address Section */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Dirección del Cliente</h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Calle / Carretera
              </label>
              <input
                type="text"
                id="address"
                name="address"
                autoComplete="street-address"
                value={client.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700 focus:border-2 text-amber-700 transition-all duration-200 ease-in-out focus:!border-amber-700"
                placeholder="Ingrese la calle o carretera"
                aria-label="Calle o Carretera"
                aria-required="true"
              />
            </div>

            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                Ciudad / Pueblo
              </label>
              <input
                type="text"
                id="city"
                name="city"
                autoComplete="address-level2"
                value={client.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700 focus:border-2 text-amber-700 transition-all duration-200 ease-in-out focus:!border-amber-700"
                placeholder="Ingrese la ciudad o pueblo"
                aria-label="Ciudad o Pueblo"
                aria-required="true"
              />
            </div>

            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                Departamento
              </label>
              <input
                type="text"
                id="department"
                name="department"
                autoComplete="address-level1"
                value={client.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-amber-700 focus:border-2 text-amber-700 transition-all duration-200 ease-in-out focus:!border-amber-700"
                placeholder="Ingrese el departamento"
                aria-label="Departamento"
                aria-required="true"
              />
            </div>
          </div>
        </div>

        {/* Observations Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Observaciones</h3>
          <div>
            <label htmlFor="observations" className="block text-sm font-medium text-gray-700 mb-1">
              Comentarios
            </label>
            <textarea
              id="observations"
              name="comentario"
              autoComplete="off"
              rows={3}
              value={client.comentario}
              onChange={(e) => handleInputChange('comentario', e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 focus:border-2 text-green-600 resize-none transition-all duration-200 ease-in-out focus:!border-green-600"
              placeholder="Ingrese comentarios adicionales u observaciones"
              aria-label="Comentarios u Observaciones"
              aria-required="false"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3 px-4 rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Procesando...' : 'Continuar al Resumen del Pedido'}
          </button>
        </div>
      </form>
      {/* Custom Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs w-full text-center">
            <div className="mb-4 text-lg font-semibold text-gray-800">¿Eliminar cliente?</div>
            <div className="mb-6 text-gray-600 text-sm">Esta acción no se puede deshacer.</div>
            <div className="flex justify-center gap-4">
              <button
                onClick={confirmDeleteClient}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
              >
                Eliminar
              </button>
              <button
                onClick={cancelDeleteClient}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}