import ExpoModulesCore

/// p4-store S2: exposes Apple's Add to Apple Wallet button to the ticket screen.
public class OutsydeWalletButtonModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OutsydeWalletButton")

    View(OutsydeWalletButtonView.self) {
      Events("onPress")

      // true on a dark background: Apple asks for the outlined style there.
      Prop("outline") { (view: OutsydeWalletButtonView, outline: Bool) in
        view.setOutline(outline)
      }
    }
  }
}
