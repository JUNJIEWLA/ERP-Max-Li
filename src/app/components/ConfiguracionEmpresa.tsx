import { useState, useEffect } from 'react';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { empresaApi, type ConfiguracionEmpresa } from '../../imports/api';

// ── Tipos internos ──────────────────────────────────────────────────

interface FormData {
  nombreComercial: string;
  razonSocial: string;
  rnc: string;
  telefonoPrincipal: string;
  telefonoSecundario: string;
  emailComercial: string;
  emailFacturacion: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  pais: string;
  sitioWeb: string;
  logoUrl: string;
  politicaDevolucion: string;
}

const EMPTY_FORM: FormData = {
  nombreComercial: '',
  razonSocial: '',
  rnc: '',
  telefonoPrincipal: '',
  telefonoSecundario: '',
  emailComercial: '',
  emailFacturacion: '',
  direccion: '',
  ciudad: '',
  provincia: '',
  pais: 'República Dominicana',
  sitioWeb: '',
  logoUrl: '',
  politicaDevolucion: '',
};

// ── Helpers ─────────────────────────────────────────────────────────

function toFormData(data: ConfiguracionEmpresa): FormData {
  return {
    nombreComercial:    data.nombreComercial    ?? '',
    razonSocial:        data.razonSocial        ?? '',
    rnc:                data.rnc                ?? '',
    telefonoPrincipal:  data.telefonoPrincipal  ?? '',
    telefonoSecundario: data.telefonoSecundario ?? '',
    emailComercial:     data.emailComercial     ?? '',
    emailFacturacion:   data.emailFacturacion   ?? '',
    direccion:          data.direccion          ?? '',
    ciudad:             data.ciudad             ?? '',
    provincia:          data.provincia          ?? '',
    pais:               data.pais               ?? 'República Dominicana',
    sitioWeb:           data.sitioWeb           ?? '',
    logoUrl:            data.logoUrl            ?? '',
    politicaDevolucion: data.politicaDevolucion ?? '',
  };
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

// ── Sub-componente: sección del formulario ──────────────────────────

interface SectionProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  color: string;
  children: React.ReactNode;
}

function FormSection({ icon: Icon, title, subtitle, color, children }: SectionProps) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className={`px-6 py-4 border-b border-border bg-gradient-to-r ${color}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm">
            <Icon size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{title}</h3>
            {subtitle && <p className="text-white/70 text-xs mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Sub-componente: campo de formulario ─────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  required?: boolean;
}

function Field({ id, label, value, onChange, placeholder, type = 'text', hint, required }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60
                   placeholder:text-muted-foreground/60 transition-shadow"
      />
      {hint && <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────

export default function ConfiguracionEmpresaView() {
  const [form, setForm]               = useState<FormData>(EMPTY_FORM);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [ultimaModif, setUltimaModif] = useState<string | null>(null);

  // ── Carga inicial ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    empresaApi.obtener()
      .then((data) => {
        if (cancelled) return;
        setForm(toFormData(data));
        setUltimaModif(data.fechaModificacion);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Error al cargar la configuración de empresa');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // ── Guardar ──────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await empresaApi.actualizar(form);
      setForm(toFormData(updated));
      setUltimaModif(updated.fechaModificacion);
      setSuccess('Configuración guardada correctamente.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof FormData) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ── Skeleton de carga ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-6 mx-auto w-full">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Cargando configuración de empresa…</span>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
            <div className="h-14 bg-muted/50" />
            <div className="p-6 grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-9 bg-muted rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 mx-auto w-full">

      {/* Encabezado de página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <Building2 size={26} className="text-primary" />
            Información de la Empresa
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Datos corporativos usados en comprobantes fiscales, reportes y correos de facturación.
          </p>
          {ultimaModif && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Clock size={12} />
              Última modificación: {formatDateTime(ultimaModif)}
            </p>
          )}
        </div>

        <button
          id="btn-guardar-empresa"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground
                     font-semibold text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20
                     disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Guardando…' : 'Guardar Cambios'}
        </button>
      </div>

      {/* Alertas de feedback */}
      {error && (
        <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-600
                        px-4 py-3.5 rounded-xl text-sm animate-in fade-in">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600
                        px-4 py-3.5 rounded-xl text-sm animate-in fade-in">
          <CheckCircle2 size={18} className="flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ── Sección 1: Datos Fiscales ─────────────────────────────── */}
      <FormSection
        icon={FileText}
        title="Datos Fiscales"
        subtitle="Información requerida para comprobantes DGII y documentos legales"
        color="from-blue-600 to-blue-700"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field
            id="empresa-nombre-comercial"
            label="Nombre Comercial"
            value={form.nombreComercial}
            onChange={setField('nombreComercial')}
            placeholder="Ej: Plaza Max"
            hint="Nombre con el que se conoce el negocio al público."
          />
          <Field
            id="empresa-razon-social"
            label="Razón Social"
            value={form.razonSocial}
            onChange={setField('razonSocial')}
            placeholder="Ej: Comercial Max S.R.L."
            hint="Nombre legal registrado en la DGII."
          />
          <div className="sm:col-span-2 sm:max-w-xs">
            <Field
              id="empresa-rnc"
              label="RNC"
              value={form.rnc}
              onChange={setField('rnc')}
              placeholder="Ej: 130123456"
              hint="9 dígitos (persona jurídica) o 11 dígitos (persona física). Sin guiones."
            />
          </div>
        </div>
      </FormSection>

      {/* ── Sección 2: Contacto ──────────────────────────────────────*/}
      <FormSection
        icon={Phone}
        title="Contacto"
        subtitle="Teléfonos y correos electrónicos del negocio"
        color="from-violet-600 to-violet-700"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field
            id="empresa-telefono-principal"
            label="Teléfono Principal"
            value={form.telefonoPrincipal}
            onChange={setField('telefonoPrincipal')}
            placeholder="Ej: 809-555-1234"
            type="tel"
          />
          <Field
            id="empresa-telefono-secundario"
            label="Teléfono Secundario"
            value={form.telefonoSecundario}
            onChange={setField('telefonoSecundario')}
            placeholder="Ej: 829-555-5678"
            type="tel"
          />
          <Field
            id="empresa-email-comercial"
            label="Email Comercial"
            value={form.emailComercial}
            onChange={setField('emailComercial')}
            placeholder="Ej: info@plasamax.com"
            type="email"
            hint="Email general de contacto del negocio."
          />
          <Field
            id="empresa-email-facturacion"
            label="Email de Facturación"
            value={form.emailFacturacion}
            onChange={setField('emailFacturacion')}
            placeholder="Ej: facturas@plasamax.com"
            type="email"
            hint="Se usa como remitente al enviar comprobantes por correo."
          />
        </div>
      </FormSection>

      {/* ── Sección 3: Dirección ────────────────────────────────────*/}
      <FormSection
        icon={MapPin}
        title="Dirección Física"
        subtitle="Ubicación del establecimiento principal"
        color="from-emerald-600 to-emerald-700"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <Field
              id="empresa-direccion"
              label="Dirección"
              value={form.direccion}
              onChange={setField('direccion')}
              placeholder="Ej: Av. 27 de Febrero #123, Local 4"
            />
          </div>
          <Field
            id="empresa-ciudad"
            label="Ciudad / Municipio"
            value={form.ciudad}
            onChange={setField('ciudad')}
            placeholder="Ej: Santo Domingo"
          />
          <Field
            id="empresa-provincia"
            label="Provincia"
            value={form.provincia}
            onChange={setField('provincia')}
            placeholder="Ej: Distrito Nacional"
          />
          <div className="sm:col-span-2 sm:max-w-xs">
            <Field
              id="empresa-pais"
              label="País"
              value={form.pais}
              onChange={setField('pais')}
              placeholder="República Dominicana"
            />
          </div>
        </div>
      </FormSection>

      {/* ── Sección 4: Presencia Digital ─────────────────────────── */}
      <FormSection
        icon={Globe}
        title="Presencia Digital"
        subtitle="Sitio web y recursos visuales del negocio"
        color="from-amber-600 to-amber-700"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field
            id="empresa-sitio-web"
            label="Sitio Web"
            value={form.sitioWeb}
            onChange={setField('sitioWeb')}
            placeholder="Ej: https://www.plasamax.com"
            type="url"
          />
          <Field
            id="empresa-logo-url"
            label="URL del Logo"
            value={form.logoUrl}
            onChange={setField('logoUrl')}
            placeholder="Ej: https://cdn.plasamax.com/logo.png"
            hint="URL pública a la imagen del logo. La subida de archivos estará disponible próximamente."
          />
        </div>

        {/* Vista previa del logo */}
        {form.logoUrl && (
          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Vista previa del logo
            </p>
            <div className="inline-flex items-center justify-center bg-muted/40 border border-border rounded-xl p-4">
              <img
                src={form.logoUrl}
                alt="Logo de la empresa"
                className="max-h-20 max-w-xs object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </div>
        )}
      </FormSection>

      {/* ── Sección 5: Términos y Políticas ────────────────────────── */}
      <FormSection
        icon={ShieldCheck}
        title="Términos y Políticas de Devolución"
        subtitle="Texto impreso en la parte final de los tickets de 80mm y facturas A4"
        color="from-purple-600 to-purple-700"
      >
        <div className="space-y-2">
          <label htmlFor="empresa-politica-devolucion" className="block text-sm font-semibold text-foreground">
            Política de Devolución
          </label>
          <textarea
            id="empresa-politica-devolucion"
            rows={4}
            value={form.politicaDevolucion}
            onChange={(e) => setForm((prev) => ({ ...prev, politicaDevolucion: e.target.value }))}
            placeholder="Ej: Cambios válidos dentro de los 30 días presentando este comprobante y el producto en su empaque original..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60
                       placeholder:text-muted-foreground/60 transition-shadow leading-relaxed resize-y"
          />
          <p className="text-xs text-muted-foreground">
            Este texto se imprimirá en la última parte de todas las facturas A4 y tickets térmicos de 80mm.
          </p>
        </div>
      </FormSection>

      {/* Botón de guardar duplicado al final para comodidad */}
      <div className="flex justify-end pt-2 pb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground
                     font-semibold text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Guardando…' : 'Guardar Cambios'}
        </button>
      </div>

    </div>
  );
}
