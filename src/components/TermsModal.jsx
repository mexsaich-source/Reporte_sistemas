import React from 'react';
import { X, ShieldCheck, FileText, Lock, Globe } from 'lucide-react';

const TermsModal = ({ isOpen, onClose, type = 'terms' }) => {
    const [showDetails, setShowDetails] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setShowDetails(false);
        }
    }, [isOpen, type]);

    if (!isOpen) return null;

    const content = type === 'terms' ? {
        title: "Términos de Servicio",
        subtitle: "Condiciones de uso, responsabilidades y límites del servicio",
        summary: [
            "Uso estrictamente laboral y para operación autorizada.",
            "La cuenta y credenciales son personales e intransferibles.",
            "Toda actividad puede ser auditada por seguridad y cumplimiento.",
            "El uso indebido puede generar bloqueo y medidas administrativas.",
            "El uso continuo implica aceptación de la versión vigente."
        ],
        sections: [
            {
                icon: <ShieldCheck size={20} className="text-indigo-600" />,
                title: "1. Uso permitido del sistema",
                text: "Esta plataforma es de uso exclusivo laboral para personal autorizado. Debe utilizarse únicamente para registrar, consultar y dar seguimiento a incidencias, solicitudes, inventario y actividades vinculadas a la operación de la organización."
            },
            {
                icon: <FileText size={20} className="text-indigo-600" />,
                title: "2. Responsabilidad del usuario",
                text: "El usuario es responsable de la veracidad de la información que captura, del uso correcto de su cuenta y del resguardo del equipo asignado. Está prohibido compartir credenciales, suplantar identidades o registrar información falsa o incompleta de manera deliberada."
            },
            {
                icon: <Globe size={20} className="text-indigo-600" />,
                title: "3. Niveles de atención y tiempos",
                text: "La atención se gestiona por prioridad e impacto operativo, no únicamente por orden de llegada. Un ticket puede cambiar entre estados (abierto, asignado, en proceso, resuelto) según diagnóstico técnico, dependencias externas, disponibilidad de recursos y validación del área solicitante."
            },
            {
                icon: <Lock size={20} className="text-indigo-600" />,
                title: "4. Seguridad y cumplimiento",
                text: "Toda actividad puede ser auditada para fines de seguridad, continuidad operativa y cumplimiento interno. El uso indebido del sistema, la alteración no autorizada de datos o el acceso fuera de perfil puede derivar en bloqueo de cuenta y medidas administrativas."
            },
            {
                icon: <ShieldCheck size={20} className="text-indigo-600" />,
                title: "5. Propiedad de la información",
                text: "Los datos registrados en tickets, solicitudes, inventario y comunicaciones son confidenciales y propiedad de la organización. Deben tratarse con reserva y exclusivamente para fines de operación interna autorizada."
            },
            {
                icon: <FileText size={20} className="text-indigo-600" />,
                title: "6. Disponibilidad y cambios del servicio",
                text: "La plataforma puede tener ventanas de mantenimiento, actualizaciones o interrupciones no planeadas. El equipo de TI procurará comunicar incidencias relevantes y tiempos estimados de recuperación cuando el impacto sea general."
            },
            {
                icon: <ShieldCheck size={20} className="text-indigo-600" />,
                title: "7. Límites de uso y conductas no permitidas",
                text: "No está permitido usar la plataforma para fines personales no autorizados, extraer información masiva sin permiso, realizar pruebas de seguridad sin aprobación, o ejecutar acciones que pongan en riesgo la continuidad del servicio."
            },
            {
                icon: <Lock size={20} className="text-indigo-600" />,
                title: "8. Aceptación y vigencia",
                text: "El acceso, inicio de sesión y uso continuo de la plataforma constituyen aceptación expresa de estos términos y sus actualizaciones publicadas por la organización. Si el usuario no está de acuerdo, debe abstenerse de utilizar el sistema."
            }
        ]
    } : {
        title: "Política de Privacidad",
        subtitle: "Tratamiento y protección de datos personales y operativos",
        summary: [
            "Solo se tratan datos necesarios para soporte y continuidad operativa.",
            "El acceso a la información se limita por rol y función.",
            "No se comparten datos con terceros sin base legal o autorización.",
            "Se registran eventos para trazabilidad y mejora del servicio.",
            "Puedes solicitar corrección de datos por canales internos."
        ],
        sections: [
            {
                icon: <Lock size={20} className="text-emerald-600" />,
                title: "1. Datos que tratamos",
                text: "Tratamos datos de identidad laboral y operación: nombre, correo corporativo, área, tickets, solicitudes, historial de atención, asignaciones de equipo y trazas de uso necesarias para soporte técnico."
            },
            {
                icon: <ShieldCheck size={20} className="text-emerald-600" />,
                title: "2. Finalidad del tratamiento",
                text: "La información se utiliza para administrar incidencias, asignar recursos, mantener continuidad operativa, aplicar controles de seguridad, generar reportes de servicio y mejorar tiempos de atención."
            },
            {
                icon: <Lock size={20} className="text-emerald-600" />,
                title: "3. Seguridad y acceso",
                text: "Aplicamos autenticación, sesiones seguras y permisos por rol/departamento. El acceso a datos está limitado al personal autorizado según funciones operativas y políticas internas de separación de privilegios."
            },
            {
                icon: <ShieldCheck size={20} className="text-emerald-600" />,
                title: "4. Conservación y confidencialidad",
                text: "Los datos se conservan conforme a políticas internas, requisitos operativos y obligaciones de control. No se comparten con terceros externos sin base legal, contrato aplicable o autorización institucional."
            },
            {
                icon: <Lock size={20} className="text-emerald-600" />,
                title: "5. Sesión y navegador",
                text: "La plataforma utiliza tokens de sesión y almacenamiento local para mantener acceso seguro. Se recomienda cerrar sesión en equipos compartidos, evitar redes no confiables y no guardar contraseñas en dispositivos públicos."
            },
            {
                icon: <ShieldCheck size={20} className="text-emerald-600" />,
                title: "6. Derechos y rectificación",
                text: "El usuario puede solicitar corrección de datos operativos inexactos mediante los canales internos de soporte o administración. Algunas modificaciones pueden requerir validación por motivos de seguridad y auditoría."
            },
            {
                icon: <Lock size={20} className="text-emerald-600" />,
                title: "7. Registro de actividad",
                text: "Para seguridad y trazabilidad, la plataforma puede registrar eventos de uso, acciones administrativas y cambios relevantes de estado. Estos registros se usan para diagnóstico, cumplimiento y mejora del servicio."
            }
        ]
    };

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            ></div>

            <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[85vh]">
                {/* Header */}
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{content.title}</h2>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{content.subtitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="p-5 rounded-3xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/70 dark:bg-indigo-500/10 mb-8">
                        <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-3">
                            Resumen rápido
                        </h4>
                        <ul className="list-disc pl-5 space-y-1.5 text-sm text-indigo-900/90 dark:text-indigo-200/90 font-semibold">
                            {content.summary.map((item, idx) => (
                                <li key={`summary-${idx}`}>{item}</li>
                            ))}
                        </ul>
                        <button
                            type="button"
                            onClick={() => setShowDetails((prev) => !prev)}
                            className="mt-4 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition-all"
                        >
                            {showDetails ? 'Ocultar detalle completo' : 'Ver detalle completo'}
                        </button>
                    </div>

                    {showDetails && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            {content.sections.map((section, idx) => (
                                <div key={idx} className="flex gap-4 group">
                                    <div className="shrink-0 p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl h-fit group-hover:scale-110 transition-transform">
                                        {section.icon}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2">{section.title}</h4>
                                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                            {section.text}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-12 p-6 bg-indigo-50 dark:bg-indigo-500/5 rounded-3xl border border-indigo-100 dark:border-indigo-500/20">
                        <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300 text-center leading-relaxed">
                            Al acceder, iniciar sesión o usar la plataforma, aceptas automáticamente estos términos y la política de privacidad vigente, así como tu responsabilidad en el manejo seguro de la información.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <button
                        onClick={onClose}
                        className="w-full bg-slate-900 dark:bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-all active:scale-95 uppercase text-xs tracking-[0.2em]"
                    >
                        Entendido, cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TermsModal;
