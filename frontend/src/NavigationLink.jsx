import { validPoint } from './distance.js';
export default function NavigationLink({ spot, onNavigate }) {
  if (!validPoint(spot)) return <p className="pcn">Set a map location to enable navigation.</p>;
  return <div className="navigation-link"><button type="button" className="btn" onClick={() => onNavigate(spot)}>Navigate here</button>
    <p className="pcn">Walking directions inside StudySpot.</p></div>;
}
