import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  PlusCircle,
  RefreshCw,
  XCircle,
  FileCheck,
  Pencil,
  Save,
  X,
  CalendarDays,
  Hash,
} from 'lucide-react';
import { ncfApi, ResolucionNcf, ResolucionNcfPayload } from '../../imports/api';

interface EditForm {
  descripcion: string;
  numeroResolucion: string;
  secuenciaFinal: number;
  fechaVencimiento: string;
}

const EMPTY_NUEVA: ResolucionNcfPayload = {
  tipoNcf: '',
  descripcion: '',
  numeroResolucion: '',
  prefijo: '',
  secuenciaInicio: 1,
  secuenciaFinal: 0,
  fechaVencimiento: '',
};

export default function NcfDashboard() {
  const [resoluciones, setResoluciones] = useState<ResolucionNcf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [isNuevaOpen, setIsNuevaOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    descripcion: '',
    numeroResolucion: '',
    secuenciaFinal: 0,
    fechaVencimiento: '',
  });
  const [nuevaForm, setNuevaForm] = useState<ResolucionNcfPayload>(EMPTY_NUEVA);

  /* ── Carga desde el backend real ── */
  const cargarResoluciones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ncfApi.listar();
      setResoluciones(data);
    } catch (e: any) {
      setError(e.message || 'Error al cargar las resoluciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarResoluciones();
  }, [cargarResoluciones]);

  /* ── Helpers de color/estado ── */
  const getPorcentaje = (res: ResolucionNcf) => {
    const total = res.secuenciaFinal - res.secuenciaInicio + 1;
    const consumidos = res.secuenciaActual - res.secuenciaInicio;
    return total > 0 ? Math.min((consumidos / total) * 100, 100) : 0;
  };

  const getStatusColor = (p: number, estado: string) => {
    if (estado === 'AGOTADO' || estado === 'VENCIDO') return 'text-red-500';
    if (p >= 80) return 'text-orange-500';
    return 'text-emerald-500';
  };

  const getProgressColor = (p: number, estado: string) => {
    if (estado === 'AGOTADO' || estado === 'VENCIDO') return 'bg-red-500';
    if (p >= 80) return 'bg-orange-500';
    return 'bg-emerald-500';
  };

  const getStatusIcon = (p: number, estado: string) => {
    if (estado === 'AGOTADO' || estado === 'VENCIDO') return <XCircle className="w-5 h-5 text-red-500" />;
    if (p >= 80) return <AlertTriangle className="w-5 h-5 text-orange-500" />;
    return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  };

  const getStatusBadge = (p: number, estado: string) => {
    if (estado === 'AGOTADO') return <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">Agotado</Badge>;
    if (estado === 'VENCIDO') return <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">Vencido</Badge>;
    if (p >= 80) return <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[11px]">Alerta</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[11px]">Activo</Badge>;
  };

  const formatNcf = (prefijo: string, secuencia: number) =>
    `${prefijo}${secuencia.toString().padStart(8, '0')}`;

  // Parseo manual para evitar el desfase de zona horaria UTC vs UTC-4.
  // new Date("2026-12-31") se interpreta como UTC medianoche → en RD (UTC-4) es el 30/12.
  const formatDate = (d: string) => {
    if (!d) return '';
    const [year, month, day] = d.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-DO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  /* ── Edición inline ── */
  const startEdit = (res: ResolucionNcf) => {
    setEditingId(res.idResolucion);
    setEditForm({
      descripcion: res.descripcion,
      numeroResolucion: res.numeroResolucion,
      secuenciaFinal: res.secuenciaFinal,
      fechaVencimiento: res.fechaVencimiento,
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (res: ResolucionNcf) => {
    setSaving(true);
    try {
      const payload: ResolucionNcfPayload = {
        tipoNcf: res.tipoNcf,
        prefijo: res.prefijo,
        secuenciaInicio: res.secuenciaInicio,
        descripcion: editForm.descripcion,
        numeroResolucion: editForm.numeroResolucion,
        secuenciaFinal: Number(editForm.secuenciaFinal),
        fechaVencimiento: editForm.fechaVencimiento,
      };
      const actualizada = await ncfApi.actualizar(res.idResolucion, payload);
      setResoluciones(prev => prev.map(r => r.idResolucion === res.idResolucion ? actualizada : r));
      setEditingId(null);
    } catch (e: any) {
      alert(e.message || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Nueva Resolución ── */
  const guardarNueva = async () => {
    setSaving(true);
    try {
      // El prefijo es igual al tipoNcf por defecto (ej. B01)
      const payload: ResolucionNcfPayload = {
        ...nuevaForm,
        prefijo: nuevaForm.tipoNcf,
      };
      const creada = await ncfApi.crear(payload);
      setResoluciones(prev => [...prev, creada]);
      setIsNuevaOpen(false);
      setNuevaForm(EMPTY_NUEVA);
    } catch (e: any) {
      alert(e.message || 'Error al crear la resolución.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ── */
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <FileCheck className="w-7 h-7 text-blue-600" />
            Control de Comprobantes Fiscales (NCF)
          </h1>
          <p className="text-slate-500 text-sm mt-1">Módulo administrativo · DGII República Dominicana</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={cargarResoluciones} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Dialog open={isNuevaOpen} onOpenChange={setIsNuevaOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-200">
                <PlusCircle className="w-4 h-4" />
                Nueva Resolución
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-blue-600" />
                  Registrar Nueva Resolución NCF
                </DialogTitle>
                <DialogDescription>
                  Ingresa los datos de la resolución emitida por la DGII. La secuencia iniciará en el número indicado.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="n-tipoNcf" className="text-slate-600 font-medium text-sm">Tipo NCF</Label>
                    <Input id="n-tipoNcf" placeholder="B01" value={nuevaForm.tipoNcf}
                      onChange={e => setNuevaForm(f => ({ ...f, tipoNcf: e.target.value.toUpperCase() }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="n-res" className="text-slate-600 font-medium text-sm">Nº Resolución DGII</Label>
                    <Input id="n-res" placeholder="10002345" value={nuevaForm.numeroResolucion}
                      onChange={e => setNuevaForm(f => ({ ...f, numeroResolucion: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="n-desc" className="text-slate-600 font-medium text-sm">Descripción</Label>
                  <Input id="n-desc" placeholder="Ej. Crédito Fiscal" value={nuevaForm.descripcion}
                    onChange={e => setNuevaForm(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="n-inicio" className="text-slate-600 font-medium text-sm">Secuencia Inicial</Label>
                    <Input id="n-inicio" type="number" min={1} value={nuevaForm.secuenciaInicio}
                      onChange={e => setNuevaForm(f => ({ ...f, secuenciaInicio: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="n-fin" className="text-slate-600 font-medium text-sm">Secuencia Final</Label>
                    <Input id="n-fin" type="number" min={1} placeholder="10000" value={nuevaForm.secuenciaFinal || ''}
                      onChange={e => setNuevaForm(f => ({ ...f, secuenciaFinal: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="n-vence" className="text-slate-600 font-medium text-sm">Fecha de Vencimiento</Label>
                  <Input id="n-vence" type="date" value={nuevaForm.fechaVencimiento}
                    onChange={e => setNuevaForm(f => ({ ...f, fechaVencimiento: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNuevaOpen(false)}>Cancelar</Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={guardarNueva}
                  disabled={saving || !nuevaForm.tipoNcf || !nuevaForm.secuenciaFinal || !nuevaForm.fechaVencimiento}
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Guardar Resolución
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estado: Cargando */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      )}

      {/* Estado: Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-500">
          <XCircle className="w-10 h-10 opacity-60" />
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={cargarResoluciones}>Reintentar</Button>
        </div>
      )}

      {/* Estado: Sin datos */}
      {!loading && !error && resoluciones.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
          <FileCheck className="w-12 h-12 opacity-30" />
          <p className="text-sm">No hay resoluciones registradas. Crea la primera usando el botón "Nueva Resolución".</p>
        </div>
      )}

      {/* Cuadrícula de tarjetas */}
      {!loading && !error && resoluciones.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {resoluciones.map((res) => {
            const porcentaje = getPorcentaje(res);
            const total = res.secuenciaFinal - res.secuenciaInicio + 1;
            const consumidos = res.secuenciaActual - res.secuenciaInicio;
            const restantes = total - consumidos;
            const isWarning = porcentaje >= 80 && res.estado !== 'AGOTADO' && res.estado !== 'VENCIDO';
            const isDanger = res.estado === 'AGOTADO' || res.estado === 'VENCIDO';
            const isEditing = editingId === res.idResolucion;

            return (
              <Card key={res.idResolucion}
                className={`overflow-hidden border-t-4 transition-all hover:shadow-lg ${
                  isDanger ? 'border-t-red-500' : isWarning ? 'border-t-orange-500' : 'border-t-emerald-500'
                }`}>

                {/* Header de tarjeta */}
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-slate-800 font-mono">{res.tipoNcf}</span>
                      {getStatusBadge(porcentaje, res.estado)}
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(porcentaje, res.estado)}
                      {!isEditing ? (
                        <button
                          id={`btn-editar-ncf-${res.idResolucion}`}
                          title="Editar resolución"
                          onClick={() => startEdit(res)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          title="Cancelar edición"
                          onClick={cancelEdit}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Descripción (editable) */}
                  {isEditing ? (
                    <Input
                      value={editForm.descripcion}
                      onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))}
                      className="text-sm h-8 mt-1"
                      placeholder="Descripción del tipo NCF"
                    />
                  ) : (
                    <p className="text-sm text-slate-500 font-medium mt-0.5">{res.descripcion}</p>
                  )}

                  {/* Número de resolución (editable) */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {isEditing ? (
                      <Input
                        value={editForm.numeroResolucion}
                        onChange={e => setEditForm(f => ({ ...f, numeroResolucion: e.target.value }))}
                        className="text-xs h-7 font-mono"
                        placeholder="Nº Resolución DGII"
                      />
                    ) : (
                      <span className="text-xs font-mono text-slate-400">Res. DGII: {res.numeroResolucion}</span>
                    )}
                  </div>
                </CardHeader>

                {/* Secuencias */}
                <CardContent className="px-5 pb-4 space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                      <span className="block text-slate-400 font-semibold uppercase tracking-wider mb-1">Inicio</span>
                      <span className="font-mono text-slate-700 font-bold">{formatNcf(res.prefijo, res.secuenciaInicio)}</span>
                    </div>
                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 text-center">
                      <span className="block text-blue-400 font-semibold uppercase tracking-wider mb-1">Próximo</span>
                      <span className={`font-mono font-bold ${getStatusColor(porcentaje, res.estado)}`}>
                        {res.estado === 'AGOTADO' ? '— — —' : formatNcf(res.prefijo, res.secuenciaActual)}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                      <span className="block text-slate-400 font-semibold uppercase tracking-wider mb-1">Límite</span>
                      {isEditing ? (
                        <Input
                          type="number"
                          min={res.secuenciaActual}
                          value={editForm.secuenciaFinal}
                          onChange={e => setEditForm(f => ({ ...f, secuenciaFinal: Number(e.target.value) }))}
                          className="h-6 text-xs font-mono px-1 text-center"
                        />
                      ) : (
                        <span className="font-mono text-slate-700 font-bold">{formatNcf(res.prefijo, res.secuenciaFinal)}</span>
                      )}
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-500">
                        {consumidos === 0
                          ? 'Sin comprobantes usados'
                          : `${consumidos.toLocaleString()} usados · ${porcentaje.toFixed(1)}%`}
                      </span>
                      <span className={getStatusColor(porcentaje, res.estado)}>
                        {restantes > 0 ? `${restantes.toLocaleString()} restantes` : 'Agotado'}
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${getProgressColor(porcentaje, res.estado)}`}
                        style={{ width: `${porcentaje > 0 ? Math.max(porcentaje, 2) : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </CardContent>

                {/* Footer */}
                <CardFooter className="bg-slate-50/60 border-t border-slate-100 py-3 px-5 flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editForm.fechaVencimiento}
                        onChange={e => setEditForm(f => ({ ...f, fechaVencimiento: e.target.value }))}
                        className="h-6 text-xs px-1 w-36"
                      />
                    ) : (
                      <span>Vence: {formatDate(res.fechaVencimiento)}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <Button
                        id={`btn-guardar-ncf-${res.idResolucion}`}
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        onClick={() => saveEdit(res)}
                        disabled={saving}
                      >
                        {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Guardar
                      </Button>
                    ) : (isWarning || isDanger) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => setIsNuevaOpen(true)}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Renovar Lote
                      </Button>
                    ) : null}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
