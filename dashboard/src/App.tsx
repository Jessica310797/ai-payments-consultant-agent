import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ActionDetail, ActionsList } from './screens/Actions';
import Audit from './screens/Audit';
import AuditUpload from './screens/AuditUpload';
import ChangeDetail from './screens/ChangeDetail';
import Costs from './screens/Costs';
import Drivers from './screens/Drivers';
import FindingDetail from './screens/FindingDetail';
import Home from './screens/Home';
import More from './screens/More';
import NotFound from './screens/NotFound';
import Notifications from './screens/Notifications';
import October from './screens/October';
import Search from './screens/Search';
import Transactions from './screens/Transactions';
import { DataProvider } from './state/DataContext';

export default function App() {
  return (
    <DataProvider>
      {/* Hash routing works on any static host without server rewrites */}
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="costs" element={<Costs />} />
            <Route path="drivers" element={<Drivers />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="audit" element={<Audit />} />
            <Route path="audit/upload" element={<AuditUpload />} />
            <Route path="audit/:id" element={<FindingDetail />} />
            <Route path="october" element={<October />} />
            <Route path="october/:id" element={<ChangeDetail />} />
            <Route path="actions" element={<ActionsList />} />
            <Route path="actions/:id" element={<ActionDetail />} />
            <Route path="more" element={<More />} />
            <Route path="search" element={<Search />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </DataProvider>
  );
}
