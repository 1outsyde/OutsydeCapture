import ExpoModulesCore
import PassKit
import UIKit

/// Apple's own PKAddPassButton, filling the view. The button draws Apple's artwork in the phone's language and carries
/// Apple's VoiceOver label. A tap is sent to JS; the app opens the pass link itself.
class OutsydeWalletButtonView: ExpoView {
  let onPress = EventDispatcher()
  private let button = PKAddPassButton(addPassButtonStyle: .black)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    button.addTarget(self, action: #selector(pressed), for: .touchUpInside)
    addSubview(button)
  }

  func setOutline(_ outline: Bool) {
    button.addPassButtonStyle = outline ? .blackOutline : .black
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }

  @objc private func pressed() {
    onPress([:])
  }
}
