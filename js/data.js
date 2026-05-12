// ─── CATEGORY ICON MAP ────────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  VLAN: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  AAA: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  NTP: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  SNMP: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
  Management: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`,
  Trunks: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  Otros: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
};

const CATEGORY_CSS = {
  VLAN: 'cat-vlan', AAA: 'cat-aaa', NTP: 'cat-ntp',
  SNMP: 'cat-snmp', Management: 'cat-mgmt', Trunks: 'cat-trunk', Otros: 'cat-otros'
};

const DEFAULT_TEMPLATES = [
  {
    id: 't1', name: 'IP de Gestión', category: 'Management',
    description: 'Configura la interfaz de gestión con dirección IP estática y ruta por defecto.',
    content: `interface {INTERFAZ}
 ip address {IP_MGMT} {MASCARA}
 description Management - {HOSTNAME}
 no shutdown
!
ip default-gateway {GATEWAY}
!
ip domain-name {DOMAIN}`
  },
  {
    id: 't2', name: 'Configuración NTP', category: 'NTP',
    description: 'Sincronización horaria con servidor NTP primario y zona horaria.',
    content: `clock timezone {TIMEZONE} {OFFSET}
!
ntp server {NTP_SERVER_1}
ntp server {NTP_SERVER_2} prefer
ntp update-calendar
!
service timestamps log datetime msec localtime`
  },
  {
    id: 't3', name: 'VLAN y Acceso', category: 'VLAN',
    description: 'Crea una VLAN y configura el puerto de acceso asociado.',
    content: `vlan {VLAN_ID}
 name {VLAN_NAME}
!
interface {INTERFAZ}
 switchport mode access
 switchport access vlan {VLAN_ID}
 description {DESCRIPCION}
 spanning-tree portfast
 no shutdown`
  },
  {
    id: 't4', name: 'Trunk 802.1Q', category: 'Trunks',
    description: 'Configura un trunk 802.1Q con VLANs permitidas entre switches.',
    content: `interface {INTERFAZ}
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk allowed vlan {VLANS_PERMITIDAS}
 switchport trunk native vlan {NATIVE_VLAN}
 description Trunk to {VECINO}
 no shutdown`
  },
  {
    id: 't5', name: 'AAA con TACACS+', category: 'AAA',
    description: 'Autenticación y autorización centralizada con servidor TACACS+.',
    content: `aaa new-model
!
tacacs server {TACACS_SERVER_NAME}
 address ipv4 {TACACS_IP}
 key {TACACS_KEY}
!
aaa authentication login default group tacacs+ local
aaa authorization exec default group tacacs+ local
aaa accounting exec default start-stop group tacacs+
!
username {LOCAL_USER} privilege 15 secret {LOCAL_PASS}
!
line vty 0 15
 login authentication default
 transport input ssh`
  },
  {
    id: 't6', name: 'SNMP v3', category: 'SNMP',
    description: 'Configuración de SNMP versión 3 con autenticación y privacidad.',
    content: `snmp-server group {SNMP_GROUP} v3 priv
snmp-server user {SNMP_USER} {SNMP_GROUP} v3 auth sha {AUTH_PASS} priv aes 128 {PRIV_PASS}
snmp-server host {NMS_IP} version 3 priv {SNMP_USER}
snmp-server location {UBICACION}
snmp-server contact {CONTACTO}
snmp-server enable traps`
  },
];