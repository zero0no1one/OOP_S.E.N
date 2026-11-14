export const criteria = ['Quiet', 'Outlets', 'Space', 'Clean', 'Wi-Fi', 'Comfort'];
export const types = ['Library Corner', 'Cafe', 'Classroom'];
export const categories = ['Broken outlet', 'No / slow Wi-Fi', 'Too noisy', 'Dirty', 'Overcrowded', 'Other'];
export const zones = {
  lib: { name: 'Main Library', x: 20, y: 60, width: 180, height: 120 },
  cafe: { name: 'Cafe Row', x: 235, y: 60, width: 105, height: 120 },
  a: { name: 'Building A', x: 20, y: 225, width: 180, height: 135 },
  b: { name: 'Building B', x: 235, y: 225, width: 105, height: 135 },
};
const weights = {
  'Library Corner': [.3, .15, .1, .15, .15, .15],
  Cafe: [.1, .2, .1, .1, .3, .2],
  Classroom: [.2, .15, .2, .15, .15, .15],
};
export const notes = {
  'Library Corner': 'Library scores weigh quietness most.',
  Cafe: 'Cafe scores weigh Wi-Fi and outlets most.',
  Classroom: 'Classroom scores weigh quiet and space most.',
};
export const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
export const average = (spot, index) => mean(spot.ratings.map(rating => rating.scores[index]));
export const score = (spot, needs = []) => needs.length
  ? mean(needs.map(index => average(spot, index)))
  : weights[spot.type].reduce((sum, weight, index) => sum + weight * average(spot, index), 0);
export const level = value => !value ? 'n' : value >= 4 ? 'g' : value >= 3 ? 'm' : 'b';
export const color = value => ({ n: 'var(--ink2)', g: 'var(--good)', m: 'var(--mid)', b: 'var(--bad)' })[level(value)];
export const displayScore = value => value ? value.toFixed(1) : '–';
export const hourLabel = hour => hour === 24 ? 'Midnight' : (hour % 12 || 12) + (hour < 12 ? ' AM' : ' PM');
export const isOpen = (spot, hour) => spot.opens <= hour && hour < spot.closes;
