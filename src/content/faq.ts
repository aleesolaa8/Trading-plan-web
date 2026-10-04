/** Preguntas frecuentes de la portada. Textos revisables sin tocar componentes. */
export type FaqGroup = { id: string; title: string; items: { q: string; a: string }[] }

export const FAQ: FaqGroup[] = [
  {
    id: 'producto',
    title: 'Producto',
    items: [
      { q: '¿Qué es Time to Trade exactamente?', a: 'Una plataforma para planificar y cumplir tu trading: haces un diagnóstico, escribes tus reglas y recibes un plan, un calendario semanal, una calculadora de riesgo, un checklist y un journal que te enseña tus patrones. Todo en un mismo sitio.' },
      { q: '¿Me vais a decir qué operar?', a: 'No. Nunca damos señales ni recomendaciones de compra o venta. Te ayudamos a escribir, cumplir y revisar tu propio plan.' },
      { q: '¿Es para mí si estoy empezando?', a: 'Sí. El diagnóstico detecta tu nivel y adapta el plan: si empiezas, da más peso a formación y backtesting con un riesgo pequeño. Si ya eres profesional, organiza jornadas largas, métricas y límites.' },
      { q: '¿Sirve si opero poco tiempo al día?', a: 'Sí. El plan se adapta al tiempo que tienes, desde menos de 2 horas hasta jornadas completas, y protege tu descanso, tus comidas y tu desconexión.' },
      { q: '¿Funciona con cualquier mercado y bróker?', a: 'Sí: índices, forex, oro, petróleo, cripto, acciones o futuros. Si tu mercado no está en la lista, lo añades con su nombre. Los datos del contrato los pones tú una vez, así la calculadora sirve para cualquier bróker.' },
      { q: '¿Tengo que conectar mi cuenta del bróker?', a: 'No. Nunca te pedimos claves ni acceso a tu dinero. Tú apuntas tus operaciones en el journal; así además reflexionas sobre cada una.' },
      { q: '¿Sirve para cuentas de fondeo?', a: 'Sí. Con Pro puedes añadir tu cuenta de fondeo con las reglas de la prueba (pérdida diaria, caída máxima y objetivo) y ver en todo momento cuánto margen te queda.' },
      { q: '¿Puedo usarlo en el móvil y en el ordenador?', a: 'Sí, en los dos y con tus datos sincronizados. Además puedes instalarlo como una app desde el navegador, sin pasar por ninguna tienda de aplicaciones.' },
    ],
  },
  {
    id: 'ia',
    title: 'IA y copiloto',
    items: [
      { q: '¿Qué hace el copiloto 24 h?', a: 'Es un chat que conoce tu plan, tu calendario y tu journal. Puedes escribirle antes de una sesión, cuando dudas en una entrada o después de un mal día. Te escucha, te ayuda a ordenar la cabeza y te devuelve a tus reglas.' },
      { q: '¿La IA me dice si entrar o no en una operación?', a: 'No. Te ayuda a revisar tu checklist, tu horario, tu energía y tu riesgo, pero la decisión es siempre tuya y sale de tu plan. No operar también es cumplir el plan.' },
      { q: '¿La IA inventa mi estrategia?', a: 'No. Solo ordena y redacta las reglas que tú das. Si falta algo, te lo pregunta en lugar de inventarlo.' },
      { q: '¿El copiloto sustituye a un psicólogo?', a: 'No. Es un apoyo para tus hábitos y tu proceso de trading: pausas, descanso, disciplina. Si lo que sientes pesa mucho o dura en el tiempo, lo mejor es hablar con un profesional.' },
    ],
  },
  {
    id: 'planes',
    title: 'Planes y pagos',
    items: [
      { q: '¿Qué diferencia hay entre Core y Pro?', a: 'Con Core tienes todo para operar con un plan: diagnóstico, plan, calendario, calculadora, checklist, journal con patrones y recordatorios. Pro suma el copiloto con IA sin límite, las revisiones escritas por IA, estadísticas avanzadas y hasta 3 cuentas, por ejemplo tu cuenta personal y una de fondeo.' },
      { q: '¿Cómo funciona la prueba gratis?', a: 'Tienes 7 días con todo Pro incluido y sin poner tarjeta. Al terminar eliges el plan que quieras. Si no eliges ninguno, no se cobra nada.' },
      { q: '¿Puedo cambiar de plan o cancelar?', a: 'Sí, cuando quieras y desde tu cuenta. No hay permanencia. Si pasas a Pro, el cambio es inmediato y solo pagas la diferencia proporcional.' },
      { q: '¿Qué ventaja tiene el pago anual?', a: 'Pagas 10 meses y tienes 12.' },
      { q: '¿Recibo factura? ¿Lleva IVA?', a: 'Sí. Recibes factura por email en cada pago, con el IVA desglosado según tu país. Sirve para autónomos y empresas.' },
      { q: '¿Qué formas de pago aceptáis?', a: 'Tarjeta de débito o crédito y otros métodos habituales según tu país. El pago lo gestiona Stripe, una plataforma de pagos segura; nosotros nunca vemos los datos de tu tarjeta.' },
    ],
  },
  {
    id: 'datos',
    title: 'Datos y seguridad',
    items: [
      { q: '¿Quién ve mis datos?', a: 'Solo tú. Cada registro está aislado por usuario en la base de datos y los servidores están en la Unión Europea.' },
      { q: '¿Qué pasa con mis datos si cancelo?', a: 'Siguen siendo tuyos. Puedes descargarlos cuando quieras y, si lo pides, los borramos por completo.' },
      { q: '¿Garantizáis resultados?', a: 'No. Nadie puede garantizarlos. Te damos las herramientas para operar con un plan y cumplirlo; los resultados dependen del mercado y de ti.' },
    ],
  },
]
