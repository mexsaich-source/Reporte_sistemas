import React from 'react';
import { X, ShieldCheck, FileText, Lock, Globe } from 'lucide-react';

const TermsModal = ({ isOpen, onClose, type = 'terms' }) => {
    if (!isOpen) return null;

    const content = type === 'terms' ? {
        title: "Términos de Servicio",
        subtitle: "Condiciones de uso de la plataforma IT Helpdesk",
        sections: [
            {
                icon: <ShieldCheck size={20} className="text-indigo-600" />,
                title: "1. Aceptación del Servicio",
                text: "Al acceder y utilizar este portal, el usuario acepta estar sujeto a las políticas internas de TI de la empresa. Este sistema es para uso exclusivo laboral y gestión de activos tecnológicos."
            },
            {
                icon: <FileText size={20} className="text-indigo-600" />,
                title: "2. Uso Responsable de Equipos",
                text: "Todo equipo solicitado o reportado es propiedad de la empresa. El usuario es responsable del cuidado físico del hardware y de no instalar software no autorizado que ponga en riesgo la red corporativa."
            },
            {
                icon: <Globe size={20} className="text-indigo-600" />,
                title: "3. Horarios de Atención",
                text: "El soporte técnico opera de lunes a viernes de 8:00 AM a 6:00 PM. Los tickets creados fuera de este horario serán atendidos por orden de prioridad el siguiente día hábil."
            },
            {
                icon: <Lock size={20} className="text-indigo-00" />,
                title: "4. Propiedad de la Información",
                text: "Toda la información contenida en los reportes, chats y base de datos es confidencial y propiedad intelectual de la organización."
            }
        ]
    } : {
        title: "Política de Privacidad",
        subtitle: "Cómo protegemos tus datos personales y corporativos",
        sections: [
            {
                icon: <Lock size={20} className="text-emerald-600" />,
                title: "Resguardo de Datos",
                text: "Utilizamos infraestructura cifrada para proteger tu identidad y los detalles de tus tickets. No compartimos información con terceros externos a la organización."
            },
            {
                icon: <ShieldCheck size={20} className="text-emerald-600" />,
                title: "Uso de Cookies",
                text: "El portal utiliza tokens de sesión locales para mantenerte conectado de forma segura. No rastreamos actividad fuera de los dominios internos."
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
                    <div className="space-y-8">
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

                    <div className="mt-12 p-6 bg-indigo-50 dark:bg-indigo-500/5 rounded-3xl border border-indigo-100 dark:border-indigo-500/20">
                        <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300 text-center leading-relaxed">
                            Al usar la plataforma, confirmas que has leído y aceptas estas condiciones para un entorno de trabajo digital seguro y eficiente.
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
