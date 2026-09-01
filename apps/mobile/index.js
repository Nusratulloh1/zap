/**
 * @format
 */

// обязан быть самым первым импортом приложения (требование RNGH)
import 'react-native-gesture-handler';

import { enableFreeze } from 'react-native-screens';
import { AppRegistry } from 'react-native';

// неактивные экраны не перерисовываются во время анимации перехода
enableFreeze(true);
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
