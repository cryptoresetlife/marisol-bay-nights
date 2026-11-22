// The story of Sundown Syndicate in eight chapters. Dez walks out of county lockup into a Marisol Bay that
// developer Sterling Vance is buying block by block, with the Coral Kings gang as his muscle. Dez and his old
// friend Lupe, who runs Tiki Taco on the Ocean Strip, put a crew back together and take the city back.

export const CHAPTERS = [
  {
    id: 'homecoming', title: 'Homecoming', start: { landmark: 'police', door: true }, auto: true, reward: 1000,
    steps: [
      { type: 'talk', lines: [
        ['Lupe', "Dez! They actually let you out. Six years, and you still owe me forty bucks."],
        ['Dez', "Good to hear you too, Lupe. Tell me there's a ride."],
        ['Lupe', "My Stingray is parked out front. Come get me at Flamingo Park. We need to talk about the Strip."],
      ] },
      { type: 'spawnVehicle', name: 'ride', vehicle: 'coupe', color: '#2ec4b6', at: { landmark: 'police', curb: true, offset: [9, 0] }, yaw: Math.PI / 2 },
      { type: 'enter', vehicle: 'ride', text: "Get in Lupe's Stingray Coupe" },
      { type: 'pickup', name: 'lupe', look: 'lupe', at: { x: -180, z: -55.5 }, text: 'Pick up Lupe at Flamingo Park' },
      { type: 'talk', lines: [
        ['Lupe', 'Sterling Vance. Remember the name. He bought half of Palm Heights while you were inside.'],
        ['Dez', 'The real-estate guy from the billboards?'],
        ['Lupe', 'Same guy. And the Coral Kings do his dirty work. They want Tiki Taco next.'],
        ['Dez', 'Then we put the old crew back together.'],
      ] },
      { type: 'goto', to: { landmark: 'tikiTaco', curb: true }, inVehicle: true, text: 'Drive Lupe to Tiki Taco on the Ocean Strip' },
      { type: 'dropoff', name: 'lupe', to: { landmark: 'tikiTaco', door: true } },
      { type: 'talk', lines: [
        ['Lupe', "Here. A Viper 9. Don't make me regret it."],
        ['Dez', "You never regretted anything in your life."],
        ['Lupe', 'Come back when you are ready to work. And Dez? Welcome home.'],
      ] },
      { type: 'give', weapon: 'pistol', ammo: 60 },
    ],
  },
  {
    id: 'borrowed', title: 'Borrowed Time', start: { landmark: 'tikiTaco', door: true }, reward: 2500,
    steps: [
      { type: 'talk', lines: [
        ['Lupe', "Vance's nephew parks a Marlin GT on Lantana Street like he owns it. Which, technically, he does."],
        ['Lupe', 'We need a fast car for what comes next. The alarm will bring the cops, so lose them before you bring it in.'],
      ] },
      { type: 'spawnVehicle', name: 'marlin', vehicle: 'marlin', color: '#e63946', at: { x: -180, z: -218.9 }, yaw: Math.PI / 2, parked: true },
      { type: 'enter', vehicle: 'marlin', text: 'Steal the red Marlin GT in Palm Heights' },
      { type: 'wanted', level: 2, dispatch: 'Dispatch: stolen Marlin GT, Palm Heights, all units respond' },
      { type: 'loseWanted', text: 'Lose the cops (a Fresh Coat respray also works)' },
      { type: 'goto', to: { landmark: 'garage', curb: true }, inVehicle: 'marlin', text: "Deliver the Marlin GT to Lupe's Garage in the Dockyards" },
      { type: 'talk', lines: [['Lupe', 'Not a scratch. Okay, a few scratches. Nice work, Dez.']] },
    ],
  },
  {
    id: 'shadow', title: 'Quiet Shadow', start: { landmark: 'tikiTaco', door: true }, reward: 2000,
    steps: [
      { type: 'talk', lines: [
        ['Lupe', 'Every Friday an armored van leaves Bayfront Savings with Vance cash. Nobody knows where it goes.'],
        ['Dez', "So I follow it. Quietly."],
        ['Lupe', 'Stay close enough to see it, far enough that they never see you.'],
      ] },
      { type: 'spawnVehicle', name: 'courier', vehicle: 'van', color: '#e9ecef', at: { x: 51.1, z: 20 }, yaw: Math.PI, driver: true, noEnter: true },
      { type: 'goto', to: { x: 51, z: 40 }, radius: 45, inVehicle: true, text: 'Drive to Bayfront Savings in Downtown' },
      { type: 'follow', vehicle: 'courier', dest: { landmark: 'coralHQ', curb: true }, text: 'Follow the courier van without being spotted' },
      { type: 'reveal', what: 'coralHQ' },
      { type: 'talk', lines: [
        ['Dez', "The Coral Kings warehouse. Vance's money goes straight to the gang."],
        ['Lupe', 'Then we hit them where it hurts. Come see me at the garage.'],
      ] },
    ],
  },
  {
    id: 'reef', title: 'Reef Cleanup', start: { landmark: 'garage', door: true }, reward: 3000,
    steps: [
      { type: 'talk', lines: [
        ['Lupe', 'Marco left you something in the trunk. A Hornet SMG. Clean out the warehouse on Anchor Street.'],
        ['Dez', "And if they shoot back?"],
        ['Lupe', 'Shoot better.'],
      ] },
      { type: 'give', weapon: 'smg', ammo: 160 },
      { type: 'goto', to: { x: -180, z: 210 }, radius: 30, text: 'Go to the Coral Kings warehouse on Anchor Street' },
      { type: 'killAll', label: 'Coral Kings', allowGunfire: true, spawns: [
        { x: -205, z: 230 }, { x: -190, z: 236 }, { x: -172, z: 233 }, { x: -158, z: 229, weapon: 'smg' },
        { x: -215, z: 219, weapon: 'smg' }, { x: -146, z: 219 }, { x: -183, z: 219, weapon: 'shotgun' }, { x: -199, z: 244 },
      ], text: 'Take out the Coral Kings' },
      { type: 'talk', lines: [['Lupe', "That's the sound of the Coral Kings losing their lunch money. Vance will notice."]] },
    ],
  },
  {
    id: 'hotice', title: 'Hot Ice', start: { landmark: 'garage', door: true }, reward: 3500,
    steps: [
      { type: 'talk', lines: [
        ['Lupe', 'The warehouse had a freezer van full of evidence: Vance payroll, gang ledgers, all of it on ice.'],
        ['Lupe', 'Nina, my reporter friend, waits at the Pier. The cooling unit is busted. You have ninety seconds.'],
      ] },
      { type: 'spawnVehicle', name: 'icevan', vehicle: 'van', color: '#90e0ef', at: { landmark: 'garage', curb: true, offset: [0, 8] }, yaw: 0 },
      { type: 'enter', vehicle: 'icevan', text: 'Get in the freezer van' },
      { type: 'goto', to: { x: 377, z: -45 }, inVehicle: 'icevan', timeLimit: 95, radius: 6, text: 'Rush the van to Nina at The Pier before the evidence melts' },
      { type: 'talk', lines: [['Nina', 'Still cold! This is front page material. Vance is going to hate tomorrow morning.']] },
    ],
  },
  {
    id: 'taillights', title: 'Tail Lights', start: { landmark: 'tikiTaco', door: true }, reward: 4000,
    steps: [
      { type: 'talk', lines: [
        ['Lupe', "Dez! Rook and the Coral Kings just smashed my register and took off in a purple coupe!"],
        ['Dez', "Which way?"],
        ['Lupe', "Up Tidewater. Wreck that car!"],
      ] },
      { type: 'chase', name: 'rook', vehicle: 'coupe', color: '#8338ec', at: { x: 317.1, z: -112 }, yaw: Math.PI, text: "Wreck Rook's getaway coupe" },
      { type: 'talk', lines: [['Rook', "Okay, okay! Vance pays us to scare people. That's all I know!"], ['Dez', 'Tell him Dez is back in town.']] },
    ],
  },
  {
    id: 'bank', title: 'Bank Holiday', start: { landmark: 'tikiTaco', door: true }, reward: 12000,
    steps: [
      { type: 'talk', lines: [
        ['Lupe', 'Bayfront Savings holds the deeds Vance forged to steal the Strip. Tonight, we take them. And the cash.'],
        ['Dez', "Every cop in the city will be on us."],
        ['Lupe', "That's why I left a getaway car out back. Hold the lobby while Marco cracks the vault."],
      ] },
      { type: 'goto', to: { landmark: 'bank', door: true }, radius: 4, onFoot: true, text: 'Walk into Bayfront Savings' },
      { type: 'hold', at: { landmark: 'bank', door: true }, radius: 9, duration: 16, allowGunfire: true, text: 'Hold the lobby while the vault is cracked', alarm: true },
      { type: 'wanted', level: 4, dispatch: 'Dispatch: armed robbery at Bayfront Savings, all units, air support up' },
      { type: 'spawnVehicle', name: 'getaway', vehicle: 'marlin', color: '#ffb703', at: { x: 50.9, z: -14 }, yaw: Math.PI },
      { type: 'enter', vehicle: 'getaway', text: 'Get to the getaway Marlin GT' },
      { type: 'loseWanted', text: 'Lose the cops' },
      { type: 'goto', to: { landmark: 'safehouse', curb: true }, inVehicle: true, text: 'Lie low at the Seabreeze safehouse' },
      { type: 'talk', lines: [['Lupe', "The deeds are real forgeries and the cash is real cash. Vance has nothing left but his tower."]] },
    ],
  },
  {
    id: 'sundown', title: 'Sundown', start: { landmark: 'tikiTaco', door: true }, reward: 25000,
    steps: [
      { type: 'talk', lines: [
        ['Lupe', "Vance is clearing out of his tower tonight with whatever he has left. This ends at sundown."],
        ['Dez', 'Then I better not be late.'],
      ] },
      { type: 'goto', to: { x: 52, z: -90 }, radius: 25, text: 'Go to Vance Tower in Downtown' },
      { type: 'killAll', label: 'Vance security', boss: { x: 30, z: -90, name: 'Sterling Vance' }, allowGunfire: true, spawns: [
        { x: 40, z: -112, weapon: 'smg' }, { x: 40, z: -68, weapon: 'smg' }, { x: 52, z: -100, weapon: 'rifle' }, { x: 52, z: -80 },
        { x: 30, z: -120, weapon: 'shotgun' }, { x: 30, z: -60, weapon: 'shotgun' }, { x: 60, z: -90, weapon: 'rifle' },
      ], faction: 'guard', text: 'Take down Sterling Vance and his security' },
      { type: 'talk', lines: [['Vance', "You can't take a city from me. I OWN this city!"], ['Dez', 'Not anymore.']] },
      { type: 'wanted', level: 3, dispatch: 'Dispatch: shots fired at Vance Tower, all units' },
      { type: 'loseWanted', text: 'Lose the cops' },
      { type: 'goto', to: { landmark: 'tikiTaco', door: true }, radius: 3, text: 'Head back to Tiki Taco' },
      { type: 'talk', lines: [
        ['Lupe', 'The Strip is ours again. Tacos on the house. Forever.'],
        ['Dez', 'Forever is a long time, Lupe.'],
        ['Lupe', 'Then you better stick around. The sun is setting on Marisol Bay, and for once it looks good.'],
      ] },
    ],
  },
];
