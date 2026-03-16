package com.cafeteria.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class ThermalPrinterPlugin extends Plugin {

  private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
  private BluetoothSocket socket;
  private OutputStream outputStream;
  private String connectedAddress = "";

  @PluginMethod
  public void isAvailable(PluginCall call) {
    JSObject result = new JSObject();
    result.put("available", BluetoothAdapter.getDefaultAdapter() != null);
    result.put("requiresRuntimePermission", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S);
    call.resolve(result);
  }

  @PluginMethod
  public void requestBluetoothPermissions(PluginCall call) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      call.resolve(new JSObject().put("granted", true));
      return;
    }

    if (getPermissionState("bluetooth") == PermissionState.GRANTED) {
      call.resolve(new JSObject().put("granted", true));
      return;
    }

    requestPermissionForAlias("bluetooth", call, "permissionsCallback");
  }

  @PermissionCallback
  private void permissionsCallback(PluginCall call) {
    boolean granted = getPermissionState("bluetooth") == PermissionState.GRANTED;
    JSObject result = new JSObject();
    result.put("granted", granted);
    if (!granted) {
      result.put("message", "Permisos Bluetooth denegados");
    }
    call.resolve(result);
  }

  @PluginMethod
  public void getBondedPrinters(PluginCall call) {
    if (!ensureBluetoothPermission(call)) return;

    BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
    if (adapter == null) {
      call.resolve(new JSObject().put("devices", new JSArray()));
      return;
    }

    JSArray devices = new JSArray();
    Set<BluetoothDevice> bonded = adapter.getBondedDevices();
    if (bonded != null) {
      for (BluetoothDevice device : bonded) {
        if (device == null) continue;
        JSObject row = new JSObject();
        row.put("name", device.getName() == null ? "Impresora Bluetooth" : device.getName());
        row.put("address", device.getAddress() == null ? "" : device.getAddress());
        devices.put(row);
      }
    }

    JSObject out = new JSObject();
    out.put("devices", devices);
    call.resolve(out);
  }

  @PluginMethod
  public void connect(PluginCall call) {
    if (!ensureBluetoothPermission(call)) return;

    String address = call.getString("address", "").trim();
    if (address.isEmpty()) {
      call.reject("Dirección MAC requerida");
      return;
    }

    BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
    if (adapter == null) {
      call.reject("Bluetooth no disponible");
      return;
    }

    try {
      closeConnection();

      BluetoothDevice device = adapter.getRemoteDevice(address);
      BluetoothSocket newSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
      adapter.cancelDiscovery();
      newSocket.connect();

      socket = newSocket;
      outputStream = socket.getOutputStream();
      connectedAddress = address;

      JSObject out = new JSObject();
      out.put("connected", true);
      out.put("address", connectedAddress);
      out.put("name", device.getName() == null ? "" : device.getName());
      call.resolve(out);
    } catch (Exception e) {
      closeConnection();
      call.reject("No se pudo conectar: " + e.getMessage());
    }
  }

  @PluginMethod
  public void disconnect(PluginCall call) {
    closeConnection();
    call.resolve(new JSObject().put("connected", false));
  }

  @PluginMethod
  public void isConnected(PluginCall call) {
    JSObject out = new JSObject();
    out.put("connected", socket != null && socket.isConnected() && outputStream != null);
    out.put("address", connectedAddress);
    call.resolve(out);
  }

  @PluginMethod
  public void writeBase64(PluginCall call) {
    if (!ensureBluetoothPermission(call)) return;

    if (socket == null || outputStream == null || !socket.isConnected()) {
      call.reject("Impresora no conectada");
      return;
    }

    String base64Data = call.getString("data", "");
    if (base64Data.isEmpty()) {
      call.reject("Data vacía");
      return;
    }

    int chunkSize = Math.max(1, call.getInt("chunkSize", 256));
    int delayMs = Math.max(0, call.getInt("delayMs", 25));

    try {
      byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
      for (int offset = 0; offset < data.length; offset += chunkSize) {
        int length = Math.min(chunkSize, data.length - offset);
        outputStream.write(data, offset, length);
        outputStream.flush();
        if (delayMs > 0) {
          Thread.sleep(delayMs);
        }
      }
      call.resolve();
    } catch (Exception e) {
      call.reject("Error al escribir en impresora: " + e.getMessage());
    }
  }

  @Override
  protected void handleOnDestroy() {
    closeConnection();
    super.handleOnDestroy();
  }

  private boolean ensureBluetoothPermission(PluginCall call) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
    if (getPermissionState("bluetooth") == PermissionState.GRANTED) return true;
    call.reject("Permiso BLUETOOTH no concedido");
    return false;
  }

  private synchronized void closeConnection() {
    if (outputStream != null) {
      try {
        outputStream.close();
      } catch (IOException ignored) {}
    }

    if (socket != null) {
      try {
        socket.close();
      } catch (IOException ignored) {}
    }

    outputStream = null;
    socket = null;
    connectedAddress = "";
  }
}
