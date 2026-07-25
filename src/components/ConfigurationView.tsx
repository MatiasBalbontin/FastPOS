import React, { useState, useEffect } from 'react';
import { Check, Users, UserPlus, Shield, Trash2, Edit2, Key, CheckCircle, XCircle, Terminal, CloudDownload, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface UserItem {
  id: number;
  username: string;
  permissions: string[];
  active: number;
}

interface SystemStatus {
  gitInstalled: boolean;
  branch: string | null;
  localChanges: boolean;
  commitsBehind: number;
  fetchError: string | null;
  error?: string;
}

export function ConfigurationView() {
  const [activeTab, setActiveTab] = useState<'company' | 'users' | 'system' | 'audit'>('company');

  // --- System Updates State ---
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [updatingSystem, setUpdatingSystem] = useState(false);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);
  const [showConfirmForceUpdate, setShowConfirmForceUpdate] = useState(false);

  // --- Audit Logs State ---
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // --- Company Config State ---
  const [config, setConfig] = useState({
    company_name: '',
    company_rut: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_bank_details: '',
    company_logo: '',
    timezone_offset: 'localtime'
  });
  const [loadingCompany, setLoadingCompany] = useState(true);

  // --- Users management State ---
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // --- New/Edit User Form State ---
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    permissions: [] as string[],
    active: 1
  });

  const availableModules = [
    { id: 'sales', label: 'Punto de Venta' },
    { id: 'fiar', label: 'Permitir Fiar (Créditos)' },
    { id: 'inventory', label: 'Inventario' },
    { id: 'analytics', label: 'Reportes' },
    { id: 'history', label: 'Historial' },
    { id: 'receivables', label: 'Cuentas por Cobrar' },
    { id: 'entities', label: 'Entidades' },
    { id: 'expenses', label: 'Gastos de Caja' },
    { id: 'fixed_costs', label: 'Costos Fijos' },
    { id: 'quotes', label: 'Cotizaciones' },
    { id: 'configuration', label: 'Configuración' }
  ];

  // --- Company Settings functions ---
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/company-settings');
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      toast.error("Error al cargar la configuración de la empresa");
    } finally {
      setLoadingCompany(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setConfig(prev => ({ ...prev, company_logo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/company-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        toast.success("Configuración de empresa guardada correctamente");
      } else {
        toast.error("Error al guardar la configuración");
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  // --- Users settings functions ---
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        toast.error("Error al cargar listado de usuarios");
      }
    } catch (error) {
      toast.error("Error de conexión al cargar usuarios");
    } finally {
      setLoadingUsers(false);
    }
  };

  // --- System Updates functions ---
  const fetchSystemStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        setSystemStatus(await res.json());
      } else {
        toast.error("Error al obtener estado del sistema");
      }
    } catch {
      toast.error("Error de conexión al obtener estado");
    } finally {
      setLoadingStatus(false);
    }
  };

  // The server process restarts itself after a successful update (see
  // server/routes/system.ts), so instead of a fixed timeout we poll the
  // health endpoint until it responds again before reloading the page.
  const waitForServerAndReload = async () => {
    const maxAttempts = 40; // ~40s
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          window.location.reload();
          return;
        }
      } catch {
        // Server is still restarting; keep polling.
      }
    }
    toast.error("El servidor está tardando más de lo esperado en reiniciar. Recargue la página manualmente en unos segundos.");
  };

  const handleUpdate = async (force: boolean) => {
    setUpdatingSystem(true);
    setUpdateLogs(["Iniciando proceso de actualización...", "Por favor espere, esto puede tardar unos minutos..."]);
    try {
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force })
      });
      const data = await res.json();
      if (data.logs) {
        setUpdateLogs(data.logs);
      }
      if (res.ok && data.success) {
        toast.success("Actualización completada. Reiniciando el servidor...");
        waitForServerAndReload();
      } else {
        toast.error(data.error || "Error durante la actualización.");
      }
    } catch {
      toast.error("Error de conexión con el servidor.");
      setUpdateLogs(prev => [...prev, "Error: Error de red o tiempo de espera agotado. El servidor puede estar reiniciándose..."]);
    } finally {
      setUpdatingSystem(false);
      setShowConfirmForceUpdate(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch('/api/system/audit-logs');
      if (res.ok) {
        setAuditLogs(await res.json());
      } else {
        toast.error("Error al cargar historial de auditoría");
      }
    } catch {
      toast.error("Error de conexión al cargar auditoría");
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'system') {
      fetchSystemStatus();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.username.trim() || !userFormData.password) {
      toast.error("Ingrese usuario y contraseña");
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userFormData.username.trim().toLowerCase(),
          password: userFormData.password,
          permissions: userFormData.permissions
        })
      });

      if (res.ok) {
        toast.success("Usuario creado con éxito");
        setShowCreateModal(false);
        setUserFormData({ username: '', password: '', permissions: [], active: 1 });
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear usuario");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: userFormData.permissions,
          password: userFormData.password || undefined,
          active: userFormData.active
        })
      });

      if (res.ok) {
        toast.success("Usuario actualizado correctamente");
        setEditingUser(null);
        setUserFormData({ username: '', password: '', permissions: [], active: 1 });
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar usuario");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleDeleteUser = async (userId: number, name: string) => {
    if (!window.confirm(`¿Está seguro de eliminar permanentemente al usuario ${name}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success("Usuario eliminado");
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar usuario");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const togglePermission = (permId: string) => {
    setUserFormData(prev => {
      const exists = prev.permissions.includes(permId);
      const newPerms = exists 
        ? prev.permissions.filter(p => p !== permId) 
        : [...prev.permissions, permId];
      return { ...prev, permissions: newPerms };
    });
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      password: '',
      permissions: user.permissions,
      active: user.active
    });
  };

  const handleOpenCreate = () => {
    setUserFormData({
      username: '',
      password: '',
      permissions: [],
      active: 1
    });
    setShowCreateModal(true);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Configuración General</h2>
          <p className="text-sm text-gray-500 mt-1">Administre los datos de su local y controle el acceso de sus operadores.</p>
        </div>

        {/* Tab Selection buttons */}
        <div className="flex border border-[var(--line)] bg-white rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('company')}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
              activeTab === 'company'
                ? 'bg-[var(--primary)] text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Datos de Empresa
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-[var(--primary)] text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Users size={14} /> Usuarios y Permisos
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'system'
                ? 'bg-[var(--primary)] text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Terminal size={14} /> Sistema y Actualizaciones
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-[var(--primary)] text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Shield size={14} /> Registro de Auditoría
          </button>
        </div>
      </div>

      {activeTab === 'company' && (
        <form onSubmit={handleCompanySubmit} className="bg-white p-8 rounded-2xl border border-[var(--line)] shadow-sm space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Razón Social / Nombre Emisor</label>
              <input
                type="text"
                required
                value={config.company_name}
                onChange={e => setConfig({ ...config, company_name: e.target.value })}
                className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">RUT Emisor</label>
              <input
                type="text"
                required
                value={config.company_rut}
                onChange={e => setConfig({ ...config, company_rut: e.target.value })}
                className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Dirección</label>
              <input
                type="text"
                required
                value={config.company_address}
                onChange={e => setConfig({ ...config, company_address: e.target.value })}
                className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Teléfono</label>
              <input
                type="text"
                value={config.company_phone}
                onChange={e => setConfig({ ...config, company_phone: e.target.value })}
                className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Email de Contacto</label>
              <input
                type="email"
                value={config.company_email}
                onChange={e => setConfig({ ...config, company_email: e.target.value })}
                className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Zona Horaria (Desfase de Reportes)</label>
              <select
                value={config.timezone_offset || 'localtime'}
                onChange={e => setConfig({ ...config, timezone_offset: e.target.value })}
                className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold cursor-pointer"
              >
                <option value="localtime">Hora del Servidor (Localtime)</option>
                <option value="0 hours">UTC / GMT (Sin Desfase)</option>
                <option value="-03:00">UTC-3 (Chile Verano / Argentina / Uruguay)</option>
                <option value="-04:00">UTC-4 (Chile Invierno / Bolivia / Paraguay / Venezuela)</option>
                <option value="-05:00">UTC-5 (Perú / Colombia / Ecuador)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Datos Bancarios para Transferencia (Pie de Página)</label>
              <textarea
                required
                rows={3}
                value={config.company_bank_details}
                onChange={e => setConfig({ ...config, company_bank_details: e.target.value })}
                className="w-full bg-gray-50 border border-[var(--line)] p-3 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-medium"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Logo de la Empresa (Imagen para Cotización)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="w-full bg-gray-50 border border-[var(--line)] p-2 text-sm focus:bg-white rounded-xl focus:outline-none focus:ring-2 ring-[var(--primary)]/20 cursor-pointer"
              />
              {config.company_logo && (
                <div className="mt-3 flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-[var(--line)]">
                  <img src={config.company_logo} alt="Vista previa del logo" className="h-16 w-auto border rounded bg-white p-1 object-contain" />
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, company_logo: '' })}
                    className="text-xs text-red-600 hover:text-red-800 font-bold uppercase"
                  >
                    Eliminar Logo
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold uppercase tracking-wider text-xs px-8 py-3 rounded-xl transition-all shadow-md shadow-blue-100 flex items-center gap-2">
              <Check size={16} /> Guardar Configuración
            </button>
          </div>
        </form>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Directorio de Operadores</h3>
            <button
              onClick={handleOpenCreate}
              className="bg-[var(--primary)] text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase hover:opacity-90 transition-all shadow-md flex items-center gap-1.5"
            >
              <UserPlus size={14} /> Crear Nuevo Operador
            </button>
          </div>

          {loadingUsers ? (
            <div className="bg-white border border-[var(--line)] rounded-2xl p-8 text-center text-gray-500 font-medium shadow-sm">
              Cargando operadores...
            </div>
          ) : (
            <div className="bg-white border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-[1.5fr_4fr_1.5fr_1.5fr] bg-gray-50 p-4 border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <div>Usuario / Operador</div>
                <div>Permisos de Módulos</div>
                <div className="text-center">Estado</div>
                <div className="text-center">Acciones</div>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {users.map(u => (
                  <div key={u.id} className="grid grid-cols-[1.5fr_4fr_1.5fr_1.5fr] p-4 text-sm items-center hover:bg-gray-50/40">
                    <div className="font-bold text-[var(--ink)] uppercase tracking-wide">
                      {u.username}
                      {u.username === 'admin' && (
                        <span className="ml-2 bg-blue-100 text-blue-800 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase">Master</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 pr-4">
                      {u.username === 'admin' ? (
                        <span className="bg-slate-100 border border-slate-200 text-slate-700 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Shield size={10} /> ACCESO TOTAL
                        </span>
                      ) : (
                        u.permissions.map(p => {
                          const label = availableModules.find(m => m.id === p)?.label || p;
                          return (
                            <span key={p} className="bg-blue-50 border border-blue-100 text-blue-700 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full">
                              {label}
                            </span>
                          );
                        })
                      )}
                      {u.username !== 'admin' && u.permissions.length === 0 && (
                        <span className="text-xs text-gray-400 italic">Sin accesos otorgados</span>
                      )}
                    </div>
                    <div className="flex justify-center">
                      {u.active === 1 ? (
                        <span className="bg-green-50 border border-green-200 text-green-700 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle size={10} /> Activo
                        </span>
                      ) : (
                        <span className="bg-red-50 border border-red-200 text-red-700 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                          <XCircle size={10} /> Inactivo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 text-gray-400 hover:text-[var(--primary)] hover:bg-blue-50 rounded-lg transition-all"
                        title="Editar Permisos Credenciales"
                      >
                        <Edit2 size={15} />
                      </button>
                      {u.username !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Eliminar Operador"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'system' && (
        <div className="bg-white p-8 rounded-2xl border border-[var(--line)] shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold uppercase tracking-wide">Actualizaciones y Estado del Sistema</h3>
              <p className="text-xs text-gray-500 mt-1">Verifique el estado del código y descargue las últimas versiones desde GitHub.</p>
            </div>
            <button
              type="button"
              disabled={loadingStatus || updatingSystem}
              onClick={fetchSystemStatus}
              className="border border-[var(--line)] bg-gray-50 hover:bg-gray-100 disabled:opacity-50 p-2.5 rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 transition-all"
            >
              <RefreshCw size={14} className={loadingStatus ? "animate-spin" : ""} />
              Buscar Actualizaciones
            </button>
          </div>

          {loadingStatus && !systemStatus && (
            <div className="p-8 text-center text-gray-500 text-sm italic">Cargando estado del sistema...</div>
          )}

          {systemStatus && (
            <div className="grid grid-cols-2 gap-6">
              <div className="border border-[var(--line)] bg-gray-50/50 p-6 rounded-xl space-y-4">
                <h4 className="font-bold text-xs uppercase text-gray-400">Información del Repositorio</h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Herramienta Git:</span>
                    {systemStatus.gitInstalled ? (
                      <span className="text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded text-xs">Instalado</span>
                    ) : (
                      <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded text-xs">No encontrado</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Rama Activa:</span>
                    <span className="font-mono font-bold uppercase bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded text-xs">{systemStatus.branch || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cambios locales sin guardar:</span>
                    {systemStatus.localChanges ? (
                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded text-xs">Sí (Modificaciones pendientes)</span>
                    ) : (
                      <span className="text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded text-xs">No (Limpio)</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Estado de Actualización:</span>
                    {systemStatus.commitsBehind > 0 ? (
                      <span className="text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded text-xs">Atrasado por {systemStatus.commitsBehind} commit(s)</span>
                    ) : (
                      <span className="text-green-700 font-bold bg-green-50 px-2.5 py-0.5 rounded text-xs">Al día (Actualizado)</span>
                    )}
                  </div>
                </div>

                {systemStatus.fetchError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 font-medium">
                    {systemStatus.fetchError}
                  </div>
                )}
                {!systemStatus.gitInstalled && systemStatus.error && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 font-medium">
                    {systemStatus.error}
                  </div>
                )}
              </div>

              <div className="border border-[var(--line)] bg-gray-50/50 p-6 rounded-xl flex flex-col justify-between">
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase text-gray-400">Acciones Disponibles</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Use <strong>Actualización Segura</strong> para traer la última versión conservando cualquier cambio local pendiente.
                    Use <strong>Actualización Limpia</strong> solo si necesita descartar cambios locales y dejar el sistema exactamente como en GitHub.
                    El servidor se reiniciará solo al terminar; la página se recargará automáticamente.
                  </p>
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="button"
                    disabled={!systemStatus.gitInstalled || updatingSystem || loadingStatus}
                    onClick={() => handleUpdate(false)}
                    className="flex-1 bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] disabled:opacity-50 py-3 rounded-xl font-bold uppercase text-xs transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1.5"
                  >
                    <CloudDownload size={14} />
                    Actualización Segura
                  </button>
                  <button
                    type="button"
                    disabled={!systemStatus.gitInstalled || updatingSystem || loadingStatus}
                    onClick={() => setShowConfirmForceUpdate(true)}
                    className="px-4 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 py-3 rounded-xl font-bold uppercase text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle size={14} />
                    Limpia
                  </button>
                </div>
              </div>

              {(updateLogs.length > 0 || updatingSystem) && (
                <div className="col-span-2 border border-slate-800 bg-slate-900 text-slate-100 p-5 rounded-xl font-mono text-xs space-y-2 shadow-inner">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                    <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal size={12} /> Consola de Salida
                    </span>
                    {updatingSystem && (
                      <span className="text-blue-400 animate-pulse text-[10px] uppercase font-bold">Procesando...</span>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-2">
                    {updateLogs.map((log, i) => (
                      <div key={i} className="whitespace-pre-wrap leading-relaxed opacity-90">{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white p-8 rounded-2xl border border-[var(--line)] shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-[var(--line)] pb-4">
            <div>
              <h3 className="text-xl font-bold uppercase tracking-wide">Registro de Auditoría (Audit Logs)</h3>
              <p className="text-xs text-gray-500 mt-1">Historial detallado de operaciones críticas realizadas en el sistema.</p>
            </div>
            <button
              onClick={fetchAuditLogs}
              disabled={loadingAudit}
              className="border border-[var(--line)] bg-gray-50 hover:bg-gray-100 disabled:opacity-50 p-2.5 rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 transition-all"
            >
              <RefreshCw size={14} className={loadingAudit ? "animate-spin" : ""} />
              Actualizar Registro
            </button>
          </div>

          {loadingAudit && auditLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm italic">Cargando registro de auditoría...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm italic">No se han registrado eventos de auditoría aún.</div>
          ) : (
            <div className="border border-[var(--line)] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1.5fr_1fr_1.5fr_3fr] bg-gray-50 p-4 border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <div>Fecha</div>
                <div>Operador</div>
                <div>Acción</div>
                <div>Detalles</div>
              </div>
              <div className="divide-y divide-[var(--line)] max-h-[500px] overflow-y-auto font-medium">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="grid grid-cols-[1.5fr_1fr_1.5fr_3fr] p-4 text-xs items-start hover:bg-gray-50/40">
                    <div className="font-mono text-gray-500">{new Date(log.created_at).toLocaleString()}</div>
                    <div className="font-bold text-[var(--ink)] uppercase tracking-wide">{log.username || 'Sistema'}</div>
                    <div>
                      <span className="bg-slate-100 text-slate-700 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border border-slate-200">
                        {log.action}
                      </span>
                    </div>
                    <div className="font-mono text-gray-600 break-all whitespace-pre-wrap leading-relaxed pr-2">
                      {log.details ? JSON.stringify(log.details, null, 2) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm Force Update Modal */}
      {showConfirmForceUpdate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[var(--line)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[var(--line)] bg-red-600 text-white flex justify-between items-center">
              <h3 className="font-bold uppercase tracking-widest text-sm flex items-center gap-1.5">
                <AlertTriangle size={16} /> Confirmar Actualización Limpia
              </h3>
              <button onClick={() => setShowConfirmForceUpdate(false)} className="text-white hover:opacity-75 font-semibold">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                <strong>ATENCIÓN:</strong> Esta acción alinea el código local exactamente con el de GitHub.
              </p>
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-semibold">
                Cualquier cambio de código local que no esté guardado en GitHub se eliminará permanentemente. Esta acción no se puede deshacer.
                Esto no afecta la base de datos ni las ventas registradas.
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => handleUpdate(true)}
                  className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-red-700 transition-all"
                >
                  Sí, Descartar todo y Actualizar
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmForceUpdate(false)}
                  className="px-6 border border-[var(--line)] py-3 rounded-xl font-bold uppercase text-xs hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- User Create Modal --- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[var(--line)] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[var(--line)] bg-[var(--primary)] text-white flex justify-between items-center">
              <h3 className="font-bold uppercase tracking-widest text-sm">Crear Nuevo Operador</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white hover:opacity-75 font-semibold">✕</button>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Nombre de Usuario *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: cajero1"
                  value={userFormData.username}
                  onChange={e => setUserFormData({ ...userFormData, username: e.target.value })}
                  className="w-full bg-white border border-[var(--line)] p-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Contraseña *</label>
                <input
                  type="password"
                  required
                  placeholder="Min. 4 caracteres"
                  value={userFormData.password}
                  onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                  className="w-full bg-white border border-[var(--line)] p-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-3">Permisos de Módulos (Otorgar acceso)</label>
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border border-[var(--line)]">
                  {availableModules.map(m => {
                    const isChecked = userFormData.permissions.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-[var(--line)] cursor-pointer hover:bg-gray-50 transition-all select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(m.id)}
                          className="rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                        />
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="submit" className="flex-1 bg-[var(--primary)] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[var(--primary-dark)] transition-all">
                  Crear Operador
                </button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 border border-[var(--line)] py-3 rounded-xl font-bold uppercase text-xs hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- User Edit Modal --- */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[var(--line)] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[var(--line)] bg-[var(--primary)] text-white flex justify-between items-center">
              <h3 className="font-bold uppercase tracking-widest text-sm">Editar Operador: {editingUser.username}</h3>
              <button onClick={() => setEditingUser(null)} className="text-white hover:opacity-75 font-semibold">✕</button>
            </div>
            
            <form onSubmit={handleEditUserSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Nombre de Usuario</label>
                <input
                  type="text"
                  readOnly
                  value={editingUser.username}
                  className="w-full bg-gray-50 border border-[var(--line)] p-2.5 text-sm text-gray-500 rounded-lg outline-none font-bold uppercase"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Cambiar Contraseña (Dejar en blanco para mantener)</label>
                <input
                  type="password"
                  placeholder="Nueva contraseña"
                  value={userFormData.password}
                  onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                  className="w-full bg-white border border-[var(--line)] p-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-mono"
                />
              </div>

              {editingUser.username !== 'admin' && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Estado de la cuenta</label>
                  <select
                    value={userFormData.active}
                    onChange={e => setUserFormData({ ...userFormData, active: parseInt(e.target.value) || 0 })}
                    className="w-full bg-white border border-[var(--line)] p-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 ring-[var(--primary)]/20 font-semibold"
                  >
                    <option value={1}>ACTIVA / PERMITIR INGRESO</option>
                    <option value={0}>DESACTIVADA / BLOQUEAR INGRESO</option>
                  </select>
                </div>
              )}

              {editingUser.username !== 'admin' && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-3">Permisos de Módulos</label>
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border border-[var(--line)]">
                    {availableModules.map(m => {
                      const isChecked = userFormData.permissions.includes(m.id);
                      return (
                        <label key={m.id} className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-[var(--line)] cursor-pointer hover:bg-gray-50 transition-all select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(m.id)}
                            className="rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                          />
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{m.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button type="submit" className="flex-1 bg-[var(--primary)] text-white py-3 rounded-xl font-bold uppercase text-xs hover:bg-[var(--primary-dark)] transition-all">
                  Guardar Cambios
                </button>
                <button type="button" onClick={() => setEditingUser(null)} className="px-6 border border-[var(--line)] py-3 rounded-xl font-bold uppercase text-xs hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
