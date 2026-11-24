
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calculator } from 'lucide-react';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiClient } from '../../../core/api/client';

export const AgendaPage = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Simulator State
    const [simMode, setSimMode] = useState(false);
    const [simForm, setSimForm] = useState({ start: format(new Date(), 'yyyy-MM-dd'), days: 5, jurisdiccion: 'CABA' });
    const [simResult, setSimResult] = useState<any>(null);

    useEffect(() => {
        loadEvents();
    }, [selectedDate]);

    const loadEvents = async () => {
        setLoading(true);
        try {
            const data = await apiClient.agenda.findAll({
                month: selectedDate.getMonth() + 1,
                year: selectedDate.getFullYear()
            });
            const mapped = data.map((e: any) => ({
                id: e.id,
                title: e.titulo,
                date: new Date(e.fechaVencimiento),
                type: e.tipoPlazo,
                expediente: e.expediente ? `${e.expediente.caratula}` : 'Sin expediente',
                isCritical: e.isCritical
            }));
            setEvents(mapped);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSimulate = async () => {
        try {
            const res = await apiClient.agenda.simulateDeadline(simForm);
            setSimResult(res);
        } catch (e) {
            alert('Error en simulación');
        }
    };

    // Calendar Grid
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    // Align start to start of week (Sunday)
    const startDate = addDays(monthStart, -getDay(monthStart));
    const endDate = addDays(monthEnd, 6 - getDay(monthEnd));

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
        <div className="animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Agenda Judicial</h1>
                    <p className="text-muted">Gestión de plazos y vencimientos</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button className={`btn ${simMode ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSimMode(!simMode)}>
                        <Calculator size={18} style={{ marginRight: 8 }} />
                        {simMode ? 'Ocultar Calculadora' : 'Calculadora de Plazos'}
                    </button>
                    {/* Navigation */}
                    <div className="card" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn btn-ghost" onClick={() => setSelectedDate(d => addDays(d, -30))}>
                            <ChevronLeft size={20} />
                        </button>
                        <span style={{ fontWeight: 600, minWidth: '150px', textAlign: 'center' }}>
                            {format(selectedDate, 'MMMM yyyy', { locale: es }).toUpperCase()}
                        </span>
                        <button className="btn btn-ghost" onClick={() => setSelectedDate(d => addDays(d, 30))}>
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <div style={{ display: 'flex', gap: '2rem', flex: 1, overflow: 'hidden' }}>

                {simMode && (
                    <div className="card" style={{ padding: '1.5rem', height: 'fit-content', minWidth: '350px' }}>
                        <h3 style={{ marginTop: 0 }}>Calculadora Judicial</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            <label>
                                <span className="text-sm font-medium">Fecha Notificación</span>
                                <input type="date" className="input-field" value={simForm.start} onChange={e => setSimForm({ ...simForm, start: e.target.value })} />
                            </label>
                            <label>
                                <span className="text-sm font-medium">Días (Plazo)</span>
                                <input type="number" className="input-field" value={simForm.days} onChange={e => setSimForm({ ...simForm, days: parseInt(e.target.value) })} />
                            </label>
                            <label>
                                <span className="text-sm font-medium">Jurisdicción</span>
                                <select className="input-field" value={simForm.jurisdiccion} onChange={e => setSimForm({ ...simForm, jurisdiccion: e.target.value })}>
                                    <option value="CABA">CABA</option>
                                    <option value="PBA">Provincia Bs As</option>
                                    <option value="NACION">Nación</option>
                                </select>
                            </label>
                            <button className="btn btn-primary" onClick={handleSimulate}>Calcular Vencimiento</button>
                        </div>
                        {simResult && (
                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'hsl(var(--hsl-surface-muted))', borderRadius: 8 }}>
                                <div className="text-xs text-muted">VENCIMIENTO FATAL</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'hsl(var(--hsl-danger))' }}>
                                    {format(new Date(simResult.deadline), 'dd/MM/yyyy')}
                                </div>
                                <div className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
                                    {simResult.holidaysPayload?.length > 0 ? `${simResult.holidaysPayload.length} feriados descontados` : 'Plazo corrido sin feriados intermedios'}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Main Content: Grid */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className="card" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                            {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(d => <div key={d} className="text-xs font-bold text-muted">{d}</div>)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', flex: 1, gridAutoRows: '1fr' }}>
                            {days.map(day => {
                                const dayEvents = events.filter(e => isSameDay(e.date, day));
                                return (
                                    <div key={day.toISOString()} style={{
                                        border: '1px solid hsl(var(--hsl-border))', borderRadius: 6, padding: '0.25rem',
                                        background: isSameDay(day, new Date()) ? 'hsl(var(--hsl-surface-muted))' : 'transparent',
                                        opacity: day.getMonth() === selectedDate.getMonth() ? 1 : 0.3,
                                        display: 'flex', flexDirection: 'column'
                                    }}>
                                        <div className="text-xs font-mono mb-1">{format(day, 'd')}</div>
                                        <div style={{ overflowY: 'auto', flex: 1 }}>
                                            {dayEvents.map(ev => (
                                                <div key={ev.id} style={{
                                                    fontSize: '0.65rem', padding: '2px 4px', borderRadius: 4, marginBottom: 2,
                                                    background: ev.isCritical ? 'hsl(var(--hsl-danger))' : 'hsl(var(--hsl-primary))',
                                                    color: 'white',
                                                    cursor: 'pointer'
                                                }} title={ev.title}>
                                                    {ev.title}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Side: List (Only if not sim mode to save space, or logic?)
                    Let's only show list if SIM MODE IS OFF.
                */}
                {!simMode && (
                    <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Clock size={18} /> Vencimientos del Mes
                        </h3>
                        {events.length === 0 && !loading && <div className="text-muted text-sm">No hay eventos.</div>}
                        {events.map(ev => (
                            <EventCard key={ev.id} event={ev} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const EventCard = ({ event }: { event: any }) => {
    const isFatal = event.isCritical || event.type === 'FATAL';
    return (
        <div className="card" style={{
            padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center',
            borderLeft: isFatal ? '4px solid hsl(var(--hsl-danger))' : '4px solid hsl(var(--hsl-primary))'
        }}>
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                minWidth: '3.5rem', padding: '0.5rem', background: 'hsl(var(--hsl-surface-muted))', borderRadius: 8
            }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>{format(event.date, 'MMM', { locale: es })}</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{format(event.date, 'dd')}</span>
            </div>

            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{event.title}</h4>
                    {isFatal && <span className="badge badge-red" style={{ fontSize: '0.6rem', padding: '2px 4px' }}>FATAL</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))' }}>
                    {event.expediente}
                </div>
            </div>
        </div>
    );
};
