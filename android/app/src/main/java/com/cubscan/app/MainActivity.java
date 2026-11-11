package com.cubscan.app;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 显式开启硬件渲染，保证 WebView 内 WebGL 可用
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setLayerType(View.LAYER_TYPE_HARDWARE, null);
        }
    }
}
