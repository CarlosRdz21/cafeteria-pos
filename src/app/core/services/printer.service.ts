import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { CashRegister, Order } from '../models/domain.models';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { firstValueFrom } from 'rxjs';
import { buildApiUrl } from '../config/server.config';

export interface PrinterConfig {
  bluetoothName: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  cutPaper: boolean;
}

export interface KnownPrinter {
  id: string;
  name: string;
  lastUsedAt: string;
}

interface NativePrinterDevice {
  name: string;
  address: string;
}

interface ThermalPrinterPlugin {
  isAvailable(): Promise<{ available: boolean; requiresRuntimePermission: boolean }>;
  requestBluetoothPermissions(): Promise<{ granted: boolean; message?: string }>;
  getBondedPrinters(): Promise<{ devices: NativePrinterDevice[] }>;
  connect(options: { address: string }): Promise<{ connected: boolean; address: string; name: string }>;
  disconnect(): Promise<{ connected: boolean }>;
  isConnected(): Promise<{ connected: boolean; address?: string }>;
  writeBase64(options: { data: string; chunkSize?: number; delayMs?: number }): Promise<void>;
}

const ThermalPrinter = registerPlugin<ThermalPrinterPlugin>('ThermalPrinter');

@Injectable({
  providedIn: 'root'
})
export class PrinterService {
  private bluetoothDevice: any = null;
  private characteristic: any = null;
  private lastBluetoothIssue = '';
  private nativeConnected = false;
  private nativeConnectedAddress = '';
  private readonly ticketLogoPath = 'assets/images/logoCafeteria.png';
  private operationQueue: Promise<void> = Promise.resolve();
  private configCache: PrinterConfig | null = null;
  private configLoadPromise: Promise<PrinterConfig> | null = null;

  private readonly configKey = 'printerConfig';
  private readonly knownPrintersKey = 'knownBluetoothPrinters';
  private readonly printerSettingsApi = buildApiUrl('printer-settings');
  private readonly defaultConfig: PrinterConfig = {
    bluetoothName: 'BlueTooth Printer',
    businessName: 'CAFETERIA',
    businessAddress: '',
    businessPhone: '',
    cutPaper: true
  };

  private readonly preferredServices = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000fff0-0000-1000-8000-00805f9b34fb'
  ];

  constructor(private http: HttpClient) {
    void this.loadRemoteConfig().catch(() => undefined);
  }

  getConfig(): PrinterConfig {
    if (this.configCache) {
      return { ...this.configCache };
    }

    const config = this.readConfigFromLocalStorage();
    this.configCache = config;
    return { ...config };
  }

  saveConfig(config: Partial<PrinterConfig>): PrinterConfig {
    const merged = {
      ...this.getConfig(),
      ...config
    };
    this.configCache = merged;
    localStorage.setItem(this.configKey, JSON.stringify(merged));
    return merged;
  }

  async loadRemoteConfig(force: boolean = false): Promise<PrinterConfig> {
    if (!force && this.configLoadPromise) {
      return this.configLoadPromise;
    }

    this.configLoadPromise = firstValueFrom(this.http.get<Partial<PrinterConfig>>(this.printerSettingsApi))
      .then(remote => {
        const merged = {
          ...this.defaultConfig,
          ...(remote || {})
        };
        this.configCache = merged;
        localStorage.setItem(this.configKey, JSON.stringify(merged));
        return { ...merged };
      })
      .catch(() => {
        const fallback = this.readConfigFromLocalStorage();
        this.configCache = fallback;
        return { ...fallback };
      })
      .finally(() => {
        this.configLoadPromise = null;
      });

    return this.configLoadPromise;
  }

  async saveConfigToServer(config: Partial<PrinterConfig>): Promise<PrinterConfig> {
    const merged = this.saveConfig(config);

    try {
      const remote = await firstValueFrom(this.http.put<Partial<PrinterConfig>>(this.printerSettingsApi, merged));
      const normalized = {
        ...this.defaultConfig,
        ...(remote || {})
      };
      this.configCache = normalized;
      localStorage.setItem(this.configKey, JSON.stringify(normalized));
      return { ...normalized };
    } catch {
      return merged;
    }
  }

  async ensureConfigLoaded(): Promise<PrinterConfig> {
    return this.loadRemoteConfig();
  }

  getKnownPrinters(): KnownPrinter[] {
    const raw = localStorage.getItem(this.knownPrintersKey);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(item => item?.name)
        .map(item => ({
          id: item.id || '',
          name: item.name,
          lastUsedAt: item.lastUsedAt || new Date(0).toISOString()
        }));
    } catch {
      return [];
    }
  }

  private readConfigFromLocalStorage(): PrinterConfig {
    const raw = localStorage.getItem(this.configKey);
    if (!raw) return { ...this.defaultConfig };

    try {
      const parsed = JSON.parse(raw);
      return {
        ...this.defaultConfig,
        ...parsed
      };
    } catch {
      return { ...this.defaultConfig };
    }
  }

  private isNativeAndroidApp(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  private async ensureNativePermissions(): Promise<boolean> {
    try {
      const availability = await ThermalPrinter.isAvailable();
      if (!availability.available) {
        this.setBluetoothIssue('Bluetooth no disponible en este dispositivo');
        return false;
      }

      const permission = await ThermalPrinter.requestBluetoothPermissions();
      if (!permission.granted) {
        this.setBluetoothIssue(permission.message || 'Permisos Bluetooth denegados');
        return false;
      }

      return true;
    } catch (error: any) {
      this.setBluetoothIssue(`Error de permisos Bluetooth: ${error?.message || 'desconocido'}`);
      return false;
    }
  }

  private async getNativeBondedPrinters(): Promise<NativePrinterDevice[]> {
    try {
      const result = await ThermalPrinter.getBondedPrinters();
      return Array.isArray(result?.devices) ? result.devices : [];
    } catch {
      return [];
    }
  }

  async pairAndSelectPrinter(): Promise<KnownPrinter | null> {
    try {
      if (this.isNativeAndroidApp()) {
        const granted = await this.ensureNativePermissions();
        if (!granted) return null;

        const devices = await this.getNativeBondedPrinters();
        if (!devices.length) {
          this.setBluetoothIssue('No hay impresoras Bluetooth emparejadas en Android. Primero emparejala en Ajustes > Bluetooth y vuelve a intentar.');
          return null;
        }

        const expectedName = this.getConfig().bluetoothName;
        let selected = devices.find(d => !!expectedName && d.name === expectedName);
        if (!selected) selected = devices[0];

        for (const d of devices) {
          this.addKnownPrinter(d.name, d.address);
        }

        const printer = this.addKnownPrinter(selected.name, selected.address);
        this.saveConfig({ bluetoothName: printer.name });
        this.clearBluetoothIssue();
        return printer;
      }

      if (!this.isWebBluetoothAvailable()) {
        this.setBluetoothIssue(this.getUnsupportedBluetoothMessage());
        console.error(this.lastBluetoothIssue);
        return null;
      }

      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.preferredServices
      });

      const printer = this.addKnownPrinter(device?.name, device?.id);
      this.saveConfig({ bluetoothName: printer.name });
      this.clearBluetoothIssue();
      return printer;
    } catch (error) {
      this.setBluetoothIssue(this.mapBluetoothError(error, 'No se pudo seleccionar impresora'));
      console.error('Error al seleccionar impresora:', error);
      return null;
    }
  }

  async connectToPrinter(
    preferredName?: string,
    options: { allowRequestDevice?: boolean } = {}
  ): Promise<boolean> {
    try {
      await this.ensureConfigLoaded();

      if (this.isNativeAndroidApp()) {
        const granted = await this.ensureNativePermissions();
        if (!granted) return false;

        const expectedName = preferredName || this.getConfig().bluetoothName;
        const known = this.getKnownPrinters();
        const bonded = await this.getNativeBondedPrinters();

        if (!bonded.length) {
          this.setBluetoothIssue('No hay impresoras emparejadas en Android. Primero emparejala en Ajustes > Bluetooth.');
          return false;
        }

        let target = bonded.find(d => !!expectedName && d.name === expectedName);
        if (!target && expectedName) {
          const saved = known.find(p => p.name === expectedName && !!p.id);
          if (saved?.id) {
            target = bonded.find(d => d.address === saved.id);
          }
        }
        if (!target) target = bonded[0];

        const result = await ThermalPrinter.connect({ address: target.address });
        this.nativeConnected = !!result.connected;
        this.nativeConnectedAddress = result.address || target.address;
        this.addKnownPrinter(target.name, target.address);
        this.saveConfig({ bluetoothName: target.name });
        this.clearBluetoothIssue();
        return this.nativeConnected;
      }

      if (!this.isWebBluetoothAvailable()) {
        this.setBluetoothIssue(this.getUnsupportedBluetoothMessage());
        console.error(this.lastBluetoothIssue);
        return false;
      }

      const expectedName = preferredName || this.getConfig().bluetoothName;
      const allowRequestDevice = options.allowRequestDevice ?? true;

      const reconnected = await this.tryReconnectGrantedDevice(expectedName);
      if (reconnected) {
        return true;
      }

      if (!allowRequestDevice) {
        return false;
      }

      this.bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.preferredServices
      });

      if (expectedName && this.bluetoothDevice?.name && this.bluetoothDevice.name !== expectedName) {
        console.warn(`Impresora seleccionada: ${this.bluetoothDevice.name}. Esperada: ${expectedName}`);
      }

      this.attachDisconnectionListener(this.bluetoothDevice);
      const server = await this.bluetoothDevice.gatt.connect();
      const services = await server.getPrimaryServices();
      const writable = await this.findWritableCharacteristic(services);

      if (!writable) {
        console.error('No se encontro characteristic de escritura para la impresora');
        this.characteristic = null;
        return false;
      }

      this.characteristic = writable;
      this.addKnownPrinter(this.bluetoothDevice?.name, this.bluetoothDevice?.id);
      if (this.bluetoothDevice?.name) {
        this.saveConfig({ bluetoothName: this.bluetoothDevice.name });
      }

      this.clearBluetoothIssue();
      console.log('Impresora conectada:', this.bluetoothDevice.name);
      return true;
    } catch (error: any) {
      const name = String(error?.name || '');
      if (name === 'NotFoundError' || name === 'SecurityError') {
        this.setBluetoothIssue(this.mapBluetoothError(error, 'No se seleccionó impresora'));
        return false;
      }
      this.setBluetoothIssue(this.mapBluetoothError(error, 'Error al conectar impresora'));
      console.error('Error al conectar impresora:', error);
      console.error('Nota: muchas POS-58 usan Bluetooth clasico (SPP) y no BLE. Web Bluetooth solo funciona con BLE/GATT.');
      return false;
    }
  }

  async disconnect() {
    if (this.isNativeAndroidApp()) {
      try {
        await ThermalPrinter.disconnect();
      } catch {
        // no-op
      } finally {
        this.nativeConnected = false;
        this.nativeConnectedAddress = '';
      }
      return;
    }

    if (this.bluetoothDevice?.gatt?.connected) {
      await this.bluetoothDevice.gatt.disconnect();
    }
    this.bluetoothDevice = null;
    this.characteristic = null;
  }

  async printReceipt(order: Order, businessInfo?: any): Promise<boolean> {
    return this.enqueue(async () => {
      try {
        await this.ensureConfigLoaded();

        if (!this.isConnected()) {
          const connected = await this.connectToPrinter(undefined, { allowRequestDevice: false });
          if (!connected) return false;
        }

        try {
          const commands = await this.generateReceiptCommands(order, businessInfo, true);
          for (const command of commands) {
            await this.writeChunked(command);
          }
        } catch (withLogoError) {
          console.warn('Fallo la impresion con logo. Reintentando sin logo...', withLogoError);
          const commands = await this.generateReceiptCommands(order, businessInfo, false);
          for (const command of commands) {
            await this.writeChunked(command);
          }
        }

        return true;
      } catch (error) {
        console.error('Error al imprimir:', error);
        return false;
      }
    });
  }

  async printTestTicket(): Promise<boolean> {
    const sample: Order = {
      id: 0,
      items: [{ productId: 0, name: 'Prueba de impresion', price: 1, quantity: 1, subtotal: 1 }],
      subtotal: 1,
      tax: 0,
      total: 1,
      status: 'completed',
      createdAt: new Date().toISOString(),
      paymentMethod: 'cash',
      amountPaid: 1,
      change: 0
    };

    return this.printReceipt(sample);
  }

  async printKitchenTicket(order: Order): Promise<boolean> {
    return this.enqueue(async () => {
      try {
        await this.ensureConfigLoaded();

        if (!this.isConnected()) {
          const connected = await this.connectToPrinter(undefined, { allowRequestDevice: false });
          if (!connected) return false;
        }

        const commands = this.generateKitchenTicketCommands(order);
        for (const command of commands) {
          await this.writeChunked(command);
        }

        return true;
      } catch (error) {
        console.error('Error al imprimir comanda:', error);
        return false;
      }
    });
  }

  async printPendingAccount(order: Order): Promise<boolean> {
    return this.enqueue(async () => {
      try {
        await this.ensureConfigLoaded();

        if (!this.isConnected()) {
          const connected = await this.connectToPrinter(undefined, { allowRequestDevice: false });
          if (!connected) return false;
        }

        const commands = this.generatePendingAccountCommands(order);
        for (const command of commands) {
          await this.writeChunked(command);
        }

        return true;
      } catch (error) {
        console.error('Error al imprimir cuenta previa:', error);
        return false;
      }
    });
  }

  async printCashClosure(register: CashRegister): Promise<boolean> {
    return this.enqueue(async () => {
      try {
        await this.ensureConfigLoaded();

        if (!this.isConnected()) {
          const connected = await this.connectToPrinter(undefined, { allowRequestDevice: false });
          if (!connected) return false;
        }

        const commands = this.generateCashClosureCommands(register);
        for (const command of commands) {
          await this.writeChunked(command);
        }

        return true;
      } catch (error) {
        console.error('Error al imprimir corte de caja:', error);
        return false;
      }
    });
  }

  async openCashDrawer(): Promise<boolean> {
    return this.enqueue(async () => {
      try {
        const command = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);

        if (!this.isConnected()) {
          const connected = await this.connectToPrinter(undefined, { allowRequestDevice: false });
          if (!connected) return false;
        }

        await this.writeChunked(command);
        return true;
      } catch (error) {
        console.error('Error al abrir cajon:', error);
        return false;
      }
    });
  }

  isConnected(): boolean {
    if (this.isNativeAndroidApp()) {
      return this.nativeConnected;
    }
    return !!this.bluetoothDevice?.gatt?.connected && !!this.characteristic;
  }

  isWebBluetoothAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  isPrinterCapabilityAvailable(): boolean {
    return this.isNativeAndroidApp() || this.isWebBluetoothAvailable();
  }

  getLastBluetoothIssue(): string {
    return this.lastBluetoothIssue;
  }

  private async generateReceiptCommands(
    order: Order,
    businessInfo?: any,
    includeLogo: boolean = true
  ): Promise<Uint8Array[]> {
    const cfg = this.getConfig();
    const commands: Uint8Array[] = [];

    const ESC = 0x1b;
    const GS = 0x1d;
    const lineWidth = 32;

    const ticketNo = order.id !== undefined && order.id !== null ? `${order.id}` : this.fallbackTicketNumber();

    commands.push(new Uint8Array([ESC, 0x40]));
    commands.push(new Uint8Array([ESC, 0x74, 0x10]));

    commands.push(new Uint8Array([ESC, 0x61, 0x01]));
    // Para tickets largos, omitir logo evita saturar el buffer BLE de impresoras POS-58.
    const shouldPrintLogo = includeLogo && order.items.length <= 7;
    if (shouldPrintLogo) {
      const logoCommands = await this.buildLogoCommands(this.ticketLogoPath);
      if (logoCommands.length > 0) {
        commands.push(...logoCommands);
        commands.push(this.textToBytes('\n'));
      }
    }
    commands.push(new Uint8Array([ESC, 0x21, 0x30]));
    commands.push(this.textToBytes((businessInfo?.name || cfg.businessName || 'CAFETERIA') + '\n'));

    commands.push(new Uint8Array([ESC, 0x21, 0x00]));
    commands.push(this.textToBytes((businessInfo?.address || cfg.businessAddress || '') + '\n'));
    commands.push(this.textToBytes((businessInfo?.phone || cfg.businessPhone || '') + '\n'));
    commands.push(this.textToBytes(this.dividerLine(lineWidth)));

    commands.push(new Uint8Array([ESC, 0x61, 0x00]));
    commands.push(this.textToBytes(`Recibo #: ${ticketNo}\n`));
    commands.push(this.textToBytes(`Fecha: ${this.formatDate(order.createdAt)}\n`));
    commands.push(this.textToBytes(this.dividerLine(lineWidth)));

    for (const item of order.items) {
      const lineTotal = `$${item.subtotal.toFixed(2)}`;
      const nameLine = this.formatLine(item.name, lineTotal, lineWidth);
      commands.push(this.textToBytes(nameLine));
      commands.push(this.textToBytes(`${item.quantity} x $${item.price.toFixed(2)}\n`));
      commands.push(this.textToBytes('\n'));
    }

    commands.push(this.textToBytes(this.dividerLine(lineWidth)));
    commands.push(this.textToBytes(this.formatLine('Subtotal', `$${order.subtotal.toFixed(2)}`, lineWidth)));
    commands.push(new Uint8Array([ESC, 0x21, 0x20]));
    commands.push(this.textToBytes(this.formatLine('Total', `$${order.total.toFixed(2)}`, lineWidth)));
    commands.push(new Uint8Array([ESC, 0x21, 0x00]));

    commands.push(this.textToBytes(this.dividerLine(lineWidth)));
    const paymentMethod = order.paymentMethod === 'cash' ? 'EFECTIVO' : 'TARJETA';
    commands.push(this.textToBytes(this.formatLine('Pago', paymentMethod, lineWidth)));

    if (order.paymentMethod === 'cash') {
      if (typeof order.amountPaid === 'number') {
        commands.push(this.textToBytes(this.formatLine('Efectivo', `$${order.amountPaid.toFixed(2)}`, lineWidth)));
      }
      if (typeof order.change === 'number') {
        commands.push(this.textToBytes(this.formatLine('Cambio', `$${order.change.toFixed(2)}`, lineWidth)));
      }
    }

    commands.push(this.textToBytes('\n'));
    commands.push(new Uint8Array([ESC, 0x61, 0x01]));
    commands.push(this.textToBytes('Gracias por su preferencia\n'));

    commands.push(this.textToBytes('\n\n\n'));
    if (cfg.cutPaper) {
      commands.push(new Uint8Array([GS, 0x56, 0x00]));
    }

    return commands;
  }

  private generateKitchenTicketCommands(order: Order): Uint8Array[] {
    const cfg = this.getConfig();
    const commands: Uint8Array[] = [];
    const ESC = 0x1b;
    const GS = 0x1d;
    const lineWidth = 32;
    const ticketNo = order.id !== undefined && order.id !== null ? `${order.id}` : this.fallbackTicketNumber();

    commands.push(new Uint8Array([ESC, 0x40]));
    commands.push(new Uint8Array([ESC, 0x74, 0x10]));
    commands.push(new Uint8Array([ESC, 0x61, 0x01]));
    commands.push(new Uint8Array([ESC, 0x21, 0x20]));
    commands.push(this.textToBytes((cfg.businessName || 'CAFETERIA') + '\n'));
    commands.push(new Uint8Array([ESC, 0x21, 0x30]));
    commands.push(this.textToBytes('COMANDA\n'));
    commands.push(new Uint8Array([ESC, 0x21, 0x00]));
    commands.push(this.textToBytes(this.dividerLine(lineWidth)));

    commands.push(new Uint8Array([ESC, 0x61, 0x00]));
    commands.push(this.textToBytes(`Folio #: ${ticketNo}\n`));
    commands.push(this.textToBytes(`Fecha: ${this.formatDate(order.createdAt)}\n`));
    if (order.tableNumber?.trim()) {
      commands.push(this.textToBytes(`Mesa: ${order.tableNumber.trim()}\n`));
    }
    if (order.customerName?.trim()) {
      commands.push(this.textToBytes(`Cliente: ${order.customerName.trim()}\n`));
    }
    commands.push(this.textToBytes(this.dividerLine(lineWidth)));

    commands.push(new Uint8Array([ESC, 0x21, 0x20]));
    commands.push(this.textToBytes('PREPARAR\n'));
    commands.push(new Uint8Array([ESC, 0x21, 0x00]));

    for (const item of order.items) {
      const itemLine = `${item.quantity} x ${item.name}`;
      for (const line of this.wrapText(itemLine, lineWidth)) {
        commands.push(this.textToBytes(line + '\n'));
      }
      commands.push(this.textToBytes('\n'));
    }

    if (order.notes?.trim()) {
      commands.push(this.textToBytes(this.dividerLine(lineWidth)));
      commands.push(this.textToBytes('Notas:\n'));
      for (const line of this.wrapText(order.notes.trim(), lineWidth)) {
        commands.push(this.textToBytes(line + '\n'));
      }
      commands.push(this.textToBytes('\n'));
    }

    commands.push(this.textToBytes(this.dividerLine(lineWidth)));
    commands.push(new Uint8Array([ESC, 0x61, 0x01]));
    commands.push(this.textToBytes('Ticket de proceso\n'));
    commands.push(this.textToBytes('\n\n\n'));
    if (cfg.cutPaper) {
      commands.push(new Uint8Array([GS, 0x56, 0x00]));
    }

    return commands;
  }

  private generatePendingAccountCommands(order: Order): Uint8Array[] {
    const cfg = this.getConfig();
    const commands: Uint8Array[] = [];
    const ESC = 0x1b;
    const GS = 0x1d;
    const lineWidth = 32;
    const ticketNo = order.id !== undefined && order.id !== null ? `${order.id}` : this.fallbackTicketNumber();

    commands.push(new Uint8Array([ESC, 0x40]));
    commands.push(new Uint8Array([ESC, 0x74, 0x10]));
    commands.push(new Uint8Array([ESC, 0x61, 0x01]));
    commands.push(new Uint8Array([ESC, 0x21, 0x30]));
    commands.push(this.textToBytes((cfg.businessName || 'CAFETERIA') + '\n'));
    commands.push(new Uint8Array([ESC, 0x21, 0x20]));
    commands.push(this.textToBytes('CUENTA PREVIA\n'));
    commands.push(new Uint8Array([ESC, 0x21, 0x00]));
    commands.push(this.textToBytes(this.dividerLine(lineWidth)));

    commands.push(new Uint8Array([ESC, 0x61, 0x00]));
    commands.push(this.textToBytes(`Orden #: ${ticketNo}\n`));
    commands.push(this.textToBytes(`Fecha: ${this.formatDate(new Date())}\n`));
    if (order.tableNumber?.trim()) {
      commands.push(this.textToBytes(`Mesa: ${order.tableNumber.trim()}\n`));
    }
    if (order.customerName?.trim()) {
      commands.push(this.textToBytes(`Cliente: ${order.customerName.trim()}\n`));
    }
    commands.push(this.textToBytes(this.dividerLine(lineWidth)));

    for (const item of order.items) {
      const lineTotal = `$${item.subtotal.toFixed(2)}`;
      commands.push(this.textToBytes(this.formatLine(item.name, lineTotal, lineWidth)));
      commands.push(this.textToBytes(`${item.quantity} x $${item.price.toFixed(2)}\n`));
      commands.push(this.textToBytes('\n'));
    }

    commands.push(this.textToBytes(this.dividerLine(lineWidth)));
    commands.push(this.textToBytes(this.formatLine('Subtotal', `$${order.subtotal.toFixed(2)}`, lineWidth)));
    commands.push(new Uint8Array([ESC, 0x21, 0x20]));
    commands.push(this.textToBytes(this.formatLine('Total', `$${order.total.toFixed(2)}`, lineWidth)));
    commands.push(new Uint8Array([ESC, 0x21, 0x00]));

    commands.push(this.textToBytes('\n'));
    commands.push(new Uint8Array([ESC, 0x61, 0x01]));
    commands.push(this.textToBytes('Cuenta informativa\n'));
    commands.push(this.textToBytes('Pago pendiente\n'));
    commands.push(this.textToBytes('\n\n\n'));
    if (cfg.cutPaper) {
      commands.push(new Uint8Array([GS, 0x56, 0x00]));
    }

    return commands;
  }

  private generateCashClosureCommands(register: CashRegister): Uint8Array[] {
    const cfg = this.getConfig();
    const commands: Uint8Array[] = [];
    const ESC = 0x1b;
    const GS = 0x1d;
    const lineWidth = 32;
    const expected = register.expectedAmount ?? (register.openingAmount + register.cashSales - register.expenses);
    const counted = register.closingAmount ?? expected;
    const difference = register.difference ?? (counted - expected);
    const openedAt = register.openedAt ?? new Date();
    const closedAt = register.closedAt ?? new Date();

    commands.push(new Uint8Array([ESC, 0x40]));
    commands.push(new Uint8Array([ESC, 0x74, 0x10]));
    commands.push(new Uint8Array([ESC, 0x61, 0x01]));
    commands.push(new Uint8Array([ESC, 0x21, 0x30]));
    commands.push(this.textToBytes((cfg.businessName || 'CAFETERIA') + '\n'));
    commands.push(new Uint8Array([ESC, 0x21, 0x20]));
    commands.push(this.textToBytes('CORTE DE CAJA\n'));
    commands.push(new Uint8Array([ESC, 0x21, 0x00]));
    commands.push(this.textToBytes(this.dividerLine(lineWidth)));

    commands.push(new Uint8Array([ESC, 0x61, 0x00]));
    commands.push(this.textToBytes(`Caja #: ${register.id ?? '-'}\n`));
    commands.push(this.textToBytes(`Usuario: ${register.userId}\n`));
    commands.push(this.textToBytes(`Apertura: ${this.formatDate(openedAt)}\n`));
    commands.push(this.textToBytes(`Cierre: ${this.formatDate(closedAt)}\n`));
    commands.push(this.textToBytes(this.dividerLine(lineWidth)));

    commands.push(this.textToBytes(this.formatLine('Monto inicial', `$${register.openingAmount.toFixed(2)}`, lineWidth)));
    commands.push(this.textToBytes(this.formatLine('Ventas efectivo', `$${register.cashSales.toFixed(2)}`, lineWidth)));
    commands.push(this.textToBytes(this.formatLine('Ventas tarjeta', `$${register.cardSales.toFixed(2)}`, lineWidth)));
    commands.push(this.textToBytes(this.formatLine('Gastos', `$${register.expenses.toFixed(2)}`, lineWidth)));
    commands.push(this.textToBytes(this.formatLine('Transacciones', `${register.totalTransactions}`, lineWidth)));

    commands.push(this.textToBytes(this.dividerLine(lineWidth)));
    commands.push(this.textToBytes(this.formatLine('Efectivo esperado', `$${expected.toFixed(2)}`, lineWidth)));
    commands.push(this.textToBytes(this.formatLine('Efectivo contado', `$${counted.toFixed(2)}`, lineWidth)));
    commands.push(new Uint8Array([ESC, 0x21, 0x20]));
    commands.push(this.textToBytes(this.formatLine('Diferencia', `${difference >= 0 ? '+' : '-'}$${Math.abs(difference).toFixed(2)}`, lineWidth)));
    commands.push(new Uint8Array([ESC, 0x21, 0x00]));

    commands.push(this.textToBytes('\n\n\n'));
    if (cfg.cutPaper) {
      commands.push(new Uint8Array([GS, 0x56, 0x00]));
    }

    return commands;
  }

  private async buildLogoCommands(path: string): Promise<Uint8Array[]> {
    try {
      const image = await this.loadImage(path);
      const maxWidth = 230;
      const maxHeight = 115;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const width = Math.max(1, Math.floor(image.width * scale));
      const height = Math.max(1, Math.floor(image.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return [];

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      const rgba = ctx.getImageData(0, 0, width, height).data;
      const bytesPerRow = Math.ceil(width / 8);
      const bandHeight = 24;
      const threshold = 170;
      const commands: Uint8Array[] = [];

      for (let startY = 0; startY < height; startY += bandHeight) {
        const rows = Math.min(bandHeight, height - startY);
        const band = new Uint8Array(bytesPerRow * rows);

        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < width; x++) {
            const idx = ((startY + y) * width + x) * 4;
            const r = rgba[idx];
            const g = rgba[idx + 1];
            const b = rgba[idx + 2];
            const a = rgba[idx + 3];
            const gray = (r * 299 + g * 587 + b * 114) / 1000;
            if (a > 10 && gray < threshold) {
              band[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
            }
          }
        }

        const xL = bytesPerRow & 0xff;
        const xH = (bytesPerRow >> 8) & 0xff;
        const yL = rows & 0xff;
        const yH = (rows >> 8) & 0xff;
        const header = new Uint8Array([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
        const out = new Uint8Array(header.length + band.length);
        out.set(header, 0);
        out.set(band, header.length);
        commands.push(out);
      }

      return commands;
    } catch (error) {
      console.warn('No se pudo generar/imprimir logo del ticket:', error);
      return [];
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private dividerLine(width: number): string {
    return `${'-'.repeat(width)}\n`;
  }

  private formatLine(label: string, value: string, width: number): string {
    const cleanLabel = label.length > width ? label.slice(0, width) : label;
    const cleanValue = value.length > width ? value.slice(0, width) : value;
    const spaceCount = Math.max(1, width - cleanLabel.length - cleanValue.length);
    return `${cleanLabel}${' '.repeat(spaceCount)}${cleanValue}\n`;
  }

  private wrapText(text: string, width: number): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];

    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
        continue;
      }

      if ((current.length + 1 + word.length) <= width) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines;
  }

  private textToBytes(text: string): Uint8Array {
    const normalized = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/¡/g, '!')
      .replace(/¿/g, '?')
      .replace(/ñ/g, 'n')
      .replace(/Ñ/g, 'N');

    const encoder = new TextEncoder();
    return encoder.encode(normalized);
  }

  private fallbackTicketNumber(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
  }

  private async writeChunked(data: Uint8Array): Promise<void> {
    if (this.isNativeAndroidApp()) {
      await this.nativeWrite(data);
      return;
    }

    if (!this.characteristic) {
      throw new Error('No hay characteristic de escritura');
    }

    const maxChunk = 80;
    for (let i = 0; i < data.length; i += maxChunk) {
      const chunk = data.slice(i, i + maxChunk);
      await this.writeChunkWithRetry(chunk);
      await this.delay(60);
    }
  }

  private async nativeWrite(data: Uint8Array): Promise<void> {
    await ThermalPrinter.writeBase64({
      data: this.toBase64(data),
      chunkSize: 256,
      delayMs: 25
    });
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      const sub = bytes.subarray(i, i + chunk);
      binary += String.fromCharCode(...sub);
    }
    return btoa(binary);
  }

  private async writeChunkWithRetry(chunk: Uint8Array): Promise<void> {
    const canWrite =
      !!this.characteristic?.properties?.write &&
      typeof this.characteristic.writeValue === 'function';
    const canWriteWithoutResponse =
      !!this.characteristic?.properties?.writeWithoutResponse &&
      typeof this.characteristic.writeValueWithoutResponse === 'function';

    const writer = canWrite
      ? this.characteristic.writeValue.bind(this.characteristic)
      : canWriteWithoutResponse
      ? this.characteristic.writeValueWithoutResponse.bind(this.characteristic)
      : null;

    if (!writer) {
      throw new Error('La characteristic no soporta escritura');
    }

    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await writer(chunk);
        return;
      } catch (error: any) {
        lastError = error;
        const msg = String(error?.message || '').toLowerCase();
        if (msg.includes('in progress') || msg.includes('operation failed') || msg.includes('gatt')) {
          await this.delay(120);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  private async findWritableCharacteristic(services: any[]): Promise<any | null> {
    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties?.write || ch.properties?.writeWithoutResponse) {
          return ch;
        }
      }
    }

    for (const serviceId of this.preferredServices) {
      try {
        const service = await this.bluetoothDevice.gatt.getPrimaryService(serviceId);
        const chars = await service.getCharacteristics();
        for (const ch of chars) {
          if (ch.properties?.write || ch.properties?.writeWithoutResponse) {
            return ch;
          }
        }
      } catch {
        // try next
      }
    }

    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private formatDate(date: Date | string): string {
    return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es });
  }

  private addKnownPrinter(name?: string, id?: string): KnownPrinter {
    const safeName = (name || '').trim() || 'Impresora Bluetooth';
    const safeId = (id || '').trim();

    const knownPrinters = this.getKnownPrinters();
    const now = new Date().toISOString();
    const index = knownPrinters.findIndex(p => (safeId && p.id === safeId) || p.name === safeName);

    const printer: KnownPrinter = {
      id: safeId,
      name: safeName,
      lastUsedAt: now
    };

    if (index >= 0) {
      knownPrinters[index] = printer;
    } else {
      knownPrinters.unshift(printer);
    }

    localStorage.setItem(this.knownPrintersKey, JSON.stringify(knownPrinters));
    return printer;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.operationQueue.then(task, task);
    this.operationQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  private async tryReconnectGrantedDevice(expectedName: string): Promise<boolean> {
    try {
      const bluetooth = (navigator as any).bluetooth;
      if (!bluetooth?.getDevices) return false;

      const grantedDevices = await bluetooth.getDevices();
      if (!Array.isArray(grantedDevices) || grantedDevices.length === 0) return false;

      const target = grantedDevices.find((device: any) => !expectedName || device?.name === expectedName);
      if (!target?.gatt) return false;

      this.bluetoothDevice = target;
      this.attachDisconnectionListener(this.bluetoothDevice);
      const server = await this.bluetoothDevice.gatt.connect();
      const services = await server.getPrimaryServices();
      const writable = await this.findWritableCharacteristic(services);
      if (!writable) return false;

      this.characteristic = writable;
      this.addKnownPrinter(this.bluetoothDevice?.name, this.bluetoothDevice?.id);
      if (this.bluetoothDevice?.name) {
      this.saveConfig({ bluetoothName: this.bluetoothDevice.name });
      }
      return true;
    } catch {
      return false;
    }
  }

  private attachDisconnectionListener(device: any): void {
    if (!device || typeof device.addEventListener !== 'function') return;
    device.addEventListener('gattserverdisconnected', () => {
      this.characteristic = null;
    });
  }

  private setBluetoothIssue(message: string): void {
    this.lastBluetoothIssue = message;
  }

  private clearBluetoothIssue(): void {
    this.lastBluetoothIssue = '';
  }

  private isCapacitorAndroid(): boolean {
    return this.isNativeAndroidApp();
  }

  private getUnsupportedBluetoothMessage(): string {
    if (this.isCapacitorAndroid()) {
      return 'Esta app Android requiere plugin nativo para impresoras Bluetooth clásicas (SPP). Web Bluetooth no está disponible aquí.';
    }
    return 'Bluetooth no soportado en este dispositivo o navegador.';
  }

  private mapBluetoothError(error: unknown, fallback: string): string {
    const name = String((error as any)?.name || '');
    if (name === 'NotFoundError') return 'No se seleccionó ninguna impresora.';
    if (name === 'SecurityError') return 'Permiso Bluetooth denegado.';
    if (name === 'NotSupportedError') return 'Bluetooth no soportado en esta plataforma.';
    return fallback;
  }
}


