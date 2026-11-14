import { useEffect, useRef, useState } from 'react';
import { hourLabel } from './model.js';
export default function TimePicker({ label, initial }) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const dialog = useRef(null), selected = useRef(null);
  const hours = Array.from({ length: 24 }, (_, i) => label === 'Closes' ? i + 1 : i);
  useEffect(() => {
    if (open) { dialog.current.showModal(); selected.current?.focus({ preventScroll: true }); selected.current?.scrollIntoView({ block: 'center' }); }
  }, [open]);
  return <div><label className="f" htmlFor={'time-' + label}>{label}</label>
    <input type="hidden" name={label.toLowerCase()} value={value} />
    <button id={'time-' + label} type="button" className="in time-trigger" aria-haspopup="dialog" onClick={() => setOpen(true)}>{hourLabel(value)} <span aria-hidden="true">▾</span></button>
    <dialog className="time-dialog" ref={dialog} aria-label={label + ' time'} onClose={() => setOpen(false)}>
      <div className="shh"><h3>{label}</h3><button type="button" className="x" aria-label="Close time picker" onClick={() => dialog.current.close()}>×</button></div>
      <div className="time-options" aria-label="Available times">{hours.map(hour => <button type="button" key={hour}
        ref={hour === value ? selected : null} aria-pressed={hour === value}
        onClick={() => { setValue(hour); dialog.current.close(); }}>{hourLabel(hour)}</button>)}</div>
    </dialog></div>;
}
