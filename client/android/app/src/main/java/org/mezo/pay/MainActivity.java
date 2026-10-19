package org.mezo.pay;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MezoPayNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
